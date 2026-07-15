// Parses the mfa_required/mfa_methods query params the backend's OAuth
// callback (oauth_callback.go) appends to the redirect URL instead of the
// normal state/code params when a first-time MFA offer or verification is
// needed before a token can be issued -- see authorizer's
// internal/service/oauth_mfa_gate.go. Standalone (no Authorizer instance
// needed) since the redirect page is the entry point, before any SDK client
// is necessarily constructed.

export const MFA_REQUIRED_PARAM = 'mfa_required';
export const MFA_METHODS_PARAM = 'mfa_methods';

export interface MfaRedirectParams {
  mfaRequired: true;
  // Raw method-name strings from the backend (e.g. 'totp', 'webauthn',
  // 'email_otp', 'sms_otp') -- intentionally not enum-typed, since the
  // backend's method list is expected to grow over time and a strict union
  // here would need updating in lockstep for no benefit to the caller, who
  // only needs to know which setup/verify screens to route to.
  mfaMethods: string[];
}

/**
 * @param url The full redirect URL (e.g. `window.location.href`), or a
 * `URL` instance. Must be absolute -- passing `window.location.search` or
 * `.pathname` will throw, since those aren't parseable as a `URL` on their
 * own.
 */
export function parseMfaRedirectParams(
  url: string | URL,
): MfaRedirectParams | null {
  const parsed = typeof url === 'string' ? new URL(url) : url;
  if (parsed.searchParams.get(MFA_REQUIRED_PARAM) !== '1') {
    return null;
  }
  const methodsParam = parsed.searchParams.get(MFA_METHODS_PARAM);
  const mfaMethods = methodsParam
    ? methodsParam.split(',').filter((m) => m.length > 0)
    : [];
  return { mfaRequired: true, mfaMethods };
}
