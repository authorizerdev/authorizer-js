import { parseMfaRedirectParams, MFA_REQUIRED_PARAM, MFA_METHODS_PARAM } from '../lib';

describe('parseMfaRedirectParams', () => {
  it('returns null when mfa_required is absent', () => {
    const result = parseMfaRedirectParams(
      'http://localhost:3000/app?state=abc&code=xyz',
    );
    expect(result).toBeNull();
  });

  it('returns null when mfa_required is present but not "1"', () => {
    const result = parseMfaRedirectParams(
      'http://localhost:3000/app?mfa_required=0&state=abc',
    );
    expect(result).toBeNull();
  });

  it('parses mfa_required=1 with a comma-separated method list', () => {
    const result = parseMfaRedirectParams(
      'http://localhost:3000/app?mfa_required=1&mfa_methods=totp%2Cwebauthn',
    );
    expect(result).toEqual({
      mfaRequired: true,
      mfaMethods: ['totp', 'webauthn'],
    });
  });

  it('handles a missing mfa_methods param as an empty list', () => {
    const result = parseMfaRedirectParams(
      'http://localhost:3000/app?mfa_required=1',
    );
    expect(result).toEqual({ mfaRequired: true, mfaMethods: [] });
  });

  it('accepts a URL instance, not just a string', () => {
    const result = parseMfaRedirectParams(
      new URL('http://localhost:3000/app?mfa_required=1&mfa_methods=totp'),
    );
    expect(result).toEqual({ mfaRequired: true, mfaMethods: ['totp'] });
  });

  it('exports the exact param-name constants the backend uses', () => {
    expect(MFA_REQUIRED_PARAM).toBe('mfa_required');
    expect(MFA_METHODS_PARAM).toBe('mfa_methods');
  });
});
