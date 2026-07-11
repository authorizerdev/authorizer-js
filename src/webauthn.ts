// Browser-side glue for the WebAuthn/passkey ceremony. The server emits
// options and expects a credential response in the exact JSON shapes defined
// by the WebAuthn spec (PublicKeyCredentialCreationOptionsJSON /
// RequestOptionsJSON on the way out, RegistrationResponseJSON /
// AuthenticationResponseJSON on the way back) - go-webauthn (the server-side
// library) is built around this exact wire format specifically to interop
// with the browser's own PublicKeyCredential.parseCreationOptionsFromJSON /
// parseRequestOptionsFromJSON / credential.toJSON(), so we use those directly
// rather than hand-rolling base64url<->ArrayBuffer conversion.
import { hasWindow } from './utils';

export const isWebauthnSupported = (): boolean =>
  hasWindow() &&
  typeof window.PublicKeyCredential !== 'undefined' &&
  typeof window.PublicKeyCredential.parseCreationOptionsFromJSON ===
    'function' &&
  typeof window.PublicKeyCredential.parseRequestOptionsFromJSON ===
    'function';

const assertSupported = () => {
  if (!isWebauthnSupported()) {
    throw new Error(
      'Passkeys are not supported in this browser (missing the WebAuthn PublicKeyCredential JSON APIs).',
    );
  }
};

// registerPasskey drives a full registration ceremony against the browser:
// pass the `options` string returned by webauthn_registration_options, get
// back the `credential` string to send to webauthn_registration_verify.
export const registerPasskey = async (optionsJSON: string): Promise<string> => {
  assertSupported();
  const options = window.PublicKeyCredential.parseCreationOptionsFromJSON(
    JSON.parse(optionsJSON),
  );
  const credential = await navigator.credentials.create({
    publicKey: options,
  });
  if (!credential || !('toJSON' in credential)) {
    throw new Error('Passkey registration was cancelled or failed.');
  }
  return JSON.stringify(
    (credential as unknown as { toJSON: () => unknown }).toJSON(),
  );
};

// loginWithPasskey drives a full login (assertion) ceremony: pass the
// `options` string returned by webauthn_login_options, get back the
// `credential` string to send to webauthn_login_verify.
export const loginWithPasskey = async (optionsJSON: string): Promise<string> => {
  assertSupported();
  const options = window.PublicKeyCredential.parseRequestOptionsFromJSON(
    JSON.parse(optionsJSON),
  );
  const credential = await navigator.credentials.get({ publicKey: options });
  if (!credential || !('toJSON' in credential)) {
    throw new Error('Passkey login was cancelled or failed.');
  }
  return JSON.stringify(
    (credential as unknown as { toJSON: () => unknown }).toJSON(),
  );
};
