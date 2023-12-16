import {
  CLEANUP_IFRAME_TIMEOUT_IN_SECONDS,
  DEFAULT_AUTHORIZE_TIMEOUT_IN_SECONDS,
} from './constants';
import { AuthorizeResponse } from './types';

export const hasWindow = (): boolean => typeof window !== 'undefined';

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
  const digestOp: any = getCryptoSubtle().digest(
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

export const executeIframe = (
  authorizeUrl: string,
  eventOrigin: string,
  timeoutInSeconds: number = DEFAULT_AUTHORIZE_TIMEOUT_IN_SECONDS,
) => {
  return new Promise<AuthorizeResponse>((resolve, reject) => {
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
      removeIframe();
    }, timeoutInSeconds * 1000);

    const iframeEventHandler: (e: MessageEvent) => void = function (e: MessageEvent) {
      if (e.origin !== eventOrigin)
        return;
      if (!e.data || !e.data.response)
        return;

      const eventSource = e.source;

      if (eventSource)
        (eventSource as any).close();

      e.data.response.error
        ? reject(e.data.response)
        : resolve(e.data.response);

      clearTimeout(timeoutSetTimeoutId);
      window.removeEventListener('message', iframeEventHandler, false);
      setTimeout(removeIframe, CLEANUP_IFRAME_TIMEOUT_IN_SECONDS * 1000);
    };

    window.addEventListener('message', iframeEventHandler, false);
    window.document.body.appendChild(iframe);
    iframe.setAttribute('src', authorizeUrl);
  });
};
