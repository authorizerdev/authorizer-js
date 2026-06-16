import {
  CLEANUP_IFRAME_TIMEOUT_IN_SECONDS,
  DEFAULT_AUTHORIZE_TIMEOUT_IN_SECONDS,
} from './constants';
import { AuthorizeResponse } from './types';

export const hasWindow = (): boolean => typeof window !== 'undefined';

// proto-gateway REST (protojson) serializes int64/uint64 fields as JSON STRINGS
// (e.g. created_at "1781590366", pagination limit "10"), while the GraphQL path
// returns them as numbers. These field names are the int64-typed fields across
// the public + admin SDK surface; we coerce them back to numbers on REST
// responses so both protocols return identically-shaped, number-typed objects.
const INT64_FIELDS = new Set([
  'created_at',
  'updated_at',
  'revoked_timestamp',
  'expires_in',
  'expires',
  'limit',
  'page',
  'offset',
  'total',
  'from_timestamp',
  'to_timestamp',
]);

// coerceInt64Fields walks a parsed REST response and converts known int64
// fields from numeric strings to numbers in place, recursing through nested
// objects and arrays. Non-numeric strings and other types are left untouched.
export const coerceInt64Fields = (value: any): any => {
  if (Array.isArray(value)) {
    value.forEach(coerceInt64Fields);
    return value;
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      const v = value[key];
      if (
        INT64_FIELDS.has(key) &&
        typeof v === 'string' &&
        v !== '' &&
        !Number.isNaN(Number(v))
      )
        value[key] = Number(v);
      else if (v && typeof v === 'object') coerceInt64Fields(v);
    }
  }
  return value;
};

export const trimURL = (url: string): string => {
  let trimmedData = url.trim();
  const lastChar = trimmedData[trimmedData.length - 1];
  if (lastChar === '/')
    trimmedData = trimmedData.slice(0, -1);

  return trimmedData;
};

export const getCrypto = () => {
  // ie 11.x uses msCrypto
  return hasWindow()
    ? ((window.crypto || (window as any).msCrypto) as Crypto)
    : null;
};

export const getCryptoSubtle = () => {
  const crypto = getCrypto();
  // safari 10.x uses webkitSubtle
  return (crypto && crypto.subtle) || (crypto as any).webkitSubtle;
};

export const createRandomString = () => {
  const charset
    = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_~.';
  let random = '';
  const crypto = getCrypto();
  if (crypto) {
    const randomValues = Array.from(crypto.getRandomValues(new Uint8Array(43)));
    randomValues.forEach(v => (random += charset[v % charset.length]));
  }
  return random;
};

export const encode = (value: string) =>
  hasWindow() ? btoa(value) : Buffer.from(value).toString('base64');
export const decode = (value: string) =>
  hasWindow() ? atob(value) : Buffer.from(value, 'base64').toString('ascii');

export const createQueryParams = (params: any) => {
  return Object.keys(params)
    .filter(k => typeof params[k] !== 'undefined')
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');
};

export const sha256 = async (s: string) => {
  const subtle = getCryptoSubtle();
  if (!subtle)
    throw new Error('Web Crypto API is not available');

  const digestOp: any = subtle.digest(
    { name: 'SHA-256' },
    new TextEncoder().encode(s),
  );

  // msCrypto (IE11) uses the old spec, which is not Promise based
  // https://msdn.microsoft.com/en-us/expression/dn904640(v=vs.71)
  if ((window as any).msCrypto) {
    return new Promise((resolve, reject) => {
      digestOp.oncomplete = (e: any) => {
        resolve(e.target.result);
      };

      digestOp.onerror = (e: ErrorEvent) => {
        reject(e.error);
      };

      digestOp.onabort = () => {
        reject(new Error('The digest operation was aborted'));
      };
    });
  }

  return await digestOp;
};

const urlEncodeB64 = (input: string) => {
  const b64Chars: { [index: string]: string } = { '+': '-', '/': '_', '=': '' };
  return input.replace(/[+/=]/g, (m: string) => b64Chars[m]);
};

// https://stackoverflow.com/questions/30106476/
const decodeB64 = (input: string) =>
  decodeURIComponent(
    atob(input)
      .split('')
      .map((c) => {
        return `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`;
      })
      .join(''),
  );

export const urlDecodeB64 = (input: string) =>
  decodeB64(input.replace(/_/g, '/').replace(/-/g, '+'));

export const bufferToBase64UrlEncoded = (input: number[] | Uint8Array) => {
  const ie11SafeInput = new Uint8Array(input);
  return urlEncodeB64(
    window.btoa(String.fromCharCode(...Array.from(ie11SafeInput))),
  );
};

const originFromAuthorizerUrl = (authorizerUrl: string): string => {
  try {
    return new URL(authorizerUrl).origin;
  }
  catch {
    return authorizerUrl;
  }
};

export const executeIframe = (
  authorizeUrl: string,
  eventOrigin: string,
  timeoutInSeconds: number = DEFAULT_AUTHORIZE_TIMEOUT_IN_SECONDS,
) => {
  return new Promise<AuthorizeResponse>((resolve, reject) => {
    const expectedOrigin = originFromAuthorizerUrl(eventOrigin);
    const iframe = window.document.createElement('iframe');
    iframe.setAttribute('id', 'authorizer-iframe');
    iframe.setAttribute('width', '0');
    iframe.setAttribute('height', '0');
    iframe.style.display = 'none';
    const removeIframe = () => {
      if (window.document.body.contains(iframe)) {
        window.document.body.removeChild(iframe);
        window.removeEventListener('message', iframeEventHandler, false);
      }
    };

    const timeoutSetTimeoutId = setTimeout(() => {
      reject(new Error('Authorization timeout'));
      removeIframe();
    }, timeoutInSeconds * 1000);

    const iframeEventHandler: (e: MessageEvent) => void = function (e: MessageEvent) {
      if (e.origin !== expectedOrigin)
        return;
      if (!e.data || !e.data.response)
        return;

      const eventSource = e.source;

      if (eventSource)
        (eventSource as any).close();

      if (e.data.response.error)
        reject(e.data.response);
      else
        resolve(e.data.response);

      clearTimeout(timeoutSetTimeoutId);
      window.removeEventListener('message', iframeEventHandler, false);
      setTimeout(removeIframe, CLEANUP_IFRAME_TIMEOUT_IN_SECONDS * 1000);
    };

    window.addEventListener('message', iframeEventHandler, false);
    window.document.body.appendChild(iframe);
    iframe.setAttribute('src', authorizeUrl);
  });
};
