export const DEFAULT_AUTHORIZE_TIMEOUT_IN_SECONDS = 60;

// OAuth2 grant-type identifiers accepted by /oauth/token.
// client_credentials (RFC 6749 §4.4) and token-exchange (RFC 8693) are
// machine/service flows — server-side only.
export const GRANT_TYPE_AUTHORIZATION_CODE = 'authorization_code';
export const GRANT_TYPE_REFRESH_TOKEN = 'refresh_token';
export const GRANT_TYPE_CLIENT_CREDENTIALS = 'client_credentials';
export const GRANT_TYPE_TOKEN_EXCHANGE =
  'urn:ietf:params:oauth:grant-type:token-exchange';

// RFC 8693 token-type URNs for subject_token_type / actor_token_type.
export const TOKEN_TYPE_ACCESS_TOKEN =
  'urn:ietf:params:oauth:token-type:access_token';
export const TOKEN_TYPE_JWT = 'urn:ietf:params:oauth:token-type:jwt';

// RFC 7523 JWT-bearer client_assertion_type (secretless client auth).
export const CLIENT_ASSERTION_TYPE_JWT_BEARER =
  'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';
export const CLEANUP_IFRAME_TIMEOUT_IN_SECONDS = 2;
export const AUTHORIZE_IFRAME_TIMEOUT = 5;
