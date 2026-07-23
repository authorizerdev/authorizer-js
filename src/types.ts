// AuthorizerSDKError is a native Error additionally carrying the GraphQL
// extensions.code from the server (e.g. "TOO_MANY_REQUESTS"), when present,
// so callers can switch on a stable code instead of matching message text.
// Optional and additive - existing code that only reads `.message` is
// unaffected.
export interface AuthorizerSDKError extends Error {
  code?: string;
}

export interface GrapQlResponseType {
  data: any | undefined;
  errors: AuthorizerSDKError[];
}
export interface ApiResponse<T> {
  errors: AuthorizerSDKError[];
  data: T | undefined;
}
/**
 * SDK configuration. Requests use `credentials: 'include'`, so cookies for the
 * Authorizer instance are sent to `authorizerURL`. That URL must be the exact,
 * trusted origin of your Authorizer deployment (correct scheme, host, and port).
 * A mistaken or attacker-controlled URL can leak session credentials.
 */
export interface ConfigType {
  authorizerURL: string;
  redirectURL: string;
  clientID?: string;
  extraHeaders?: Record<string, string>;
  /**
   * Wire protocol for the client's public API calls. Defaults to `'graphql'`
   * (POST /graphql, fully backward compatible). `'rest'` maps each method to
   * its public `POST/GET /v1/<snake>` endpoint. `'grpc'` is NOT supported in
   * JS (browsers cannot speak raw gRPC) — passing it throws.
   */
  protocol?: Protocol;
}

// Protocol selects the wire transport. JS supports graphql + rest only.
export type Protocol = 'graphql' | 'rest';

// Pagination
export interface Pagination {
  limit: number;
  page: number;
  offset: number;
  total: number;
}

// Meta
export interface Meta {
  version: string;
  client_id: string;
  is_google_login_enabled: boolean;
  is_facebook_login_enabled: boolean;
  is_github_login_enabled: boolean;
  is_linkedin_login_enabled: boolean;
  is_apple_login_enabled: boolean;
  is_discord_login_enabled: boolean;
  is_twitter_login_enabled: boolean;
  is_microsoft_login_enabled: boolean;
  is_twitch_login_enabled: boolean;
  is_roblox_login_enabled: boolean;
  is_email_verification_enabled: boolean;
  is_basic_authentication_enabled: boolean;
  is_magic_link_login_enabled: boolean;
  is_sign_up_enabled: boolean;
  is_strong_password_enabled: boolean;
  is_multi_factor_auth_enabled: boolean;
  is_mobile_basic_authentication_enabled: boolean;
  is_phone_verification_enabled: boolean;
  // Per-method MFA availability for the login UI (server derives email/SMS from
  // their provider being configured; webauthn is always available).
  is_totp_mfa_enabled: boolean;
  is_email_otp_mfa_enabled: boolean;
  is_sms_otp_mfa_enabled: boolean;
  is_webauthn_enabled: boolean;
  is_mfa_enforced: boolean;
  is_org_discovery_enabled: boolean;
}

// User
export interface User {
  id: string;
  email: string | null;
  email_verified: boolean;
  signup_methods: string;
  given_name: string | null;
  family_name: string | null;
  middle_name: string | null;
  nickname: string | null;
  preferred_username: string | null;
  gender: string | null;
  birthdate: string | null;
  phone_number: string | null;
  phone_number_verified: boolean;
  picture: string | null;
  roles: string[];
  created_at: number | null;
  updated_at: number | null;
  revoked_timestamp: number | null;
  is_multi_factor_auth_enabled: boolean | null;
  has_skipped_mfa_setup_at: number | null;
  mfa_locked_at: number | null;
  enrolled_mfa_methods?: string[];
  app_data: Record<string, any> | null;
}

// Users
export interface Users {
  pagination: Pagination;
  users: User[];
}

// VerificationRequest
export interface VerificationRequest {
  id: string;
  identifier: string | null;
  token: string | null;
  email: string | null;
  expires: number | null;
  created_at: number | null;
  updated_at: number | null;
  nonce: string | null;
  redirect_uri: string | null;
}

// VerificationRequests
export interface VerificationRequests {
  pagination: Pagination;
  verification_requests: VerificationRequest[];
}

// AuthorizerError (GraphQL Error type - renamed to avoid conflict with native Error)
export interface AuthorizerError {
  message: string;
  reason: string;
}

// AuthResponse
export interface AuthResponse {
  message: string;
  should_show_email_otp_screen: boolean | null;
  should_show_mobile_otp_screen: boolean | null;
  should_show_totp_screen: boolean | null;
  should_offer_webauthn_mfa_verify: boolean | null;
  should_offer_webauthn_mfa_setup: boolean | null;
  should_offer_email_otp_mfa_setup: boolean | null;
  should_offer_sms_otp_mfa_setup: boolean | null;
  access_token: string | null;
  id_token: string | null;
  refresh_token: string | null;
  expires_in: number | null;
  user: User | null;
  authenticator_scanner_image: string | null;
  authenticator_secret: string | null;
  authenticator_recovery_codes: string[] | null;
}

// Keep AuthToken as alias for backward compatibility
export type AuthToken = AuthResponse;

// Response
export interface Response {
  message: string;
}

// Keep GenericResponse as alias for backward compatibility
export type GenericResponse = Response;

// ForgotPasswordResponse
export interface ForgotPasswordResponse {
  message: string;
  should_show_mobile_otp_screen: boolean | null;
}

// InviteMembersResponse
export interface InviteMembersResponse {
  message: string;
  Users: User[];
}

// LoginRequest
export interface LoginRequest {
  email?: string | null;
  phone_number?: string | null;
  password: string;
  roles?: string[] | null;
  scope?: string[] | null;
  state?: string | null;
}

// SignUpRequest
export interface SignUpRequest {
  email?: string | null;
  given_name?: string | null;
  family_name?: string | null;
  middle_name?: string | null;
  nickname?: string | null;
  gender?: string | null;
  birthdate?: string | null;
  phone_number?: string | null;
  picture?: string | null;
  password: string;
  confirm_password: string;
  roles?: string[] | null;
  scope?: string[] | null;
  redirect_uri?: string | null;
  is_multi_factor_auth_enabled?: boolean | null;
  state?: string | null;
  app_data?: Record<string, any> | null;
}

// Keep SignupRequest as alias for backward compatibility
export type SignupRequest = SignUpRequest;

// MagicLinkLoginRequest
export interface MagicLinkLoginRequest {
  email: string;
  roles?: string[] | null;
  scope?: string[] | null;
  state?: string | null;
  redirect_uri?: string | null;
}

// VerifyEmailRequest
export interface VerifyEmailRequest {
  token: string;
  state?: string | null;
}

// ResendVerifyEmailRequest
export interface ResendVerifyEmailRequest {
  email: string;
  identifier: string;
  state?: string | null;
}

// VerifyOTPRequest
export interface VerifyOTPRequest {
  email?: string | null;
  phone_number?: string | null;
  otp: string;
  is_totp?: boolean | null;
  state?: string | null;
}

// Keep VerifyOtpRequest as alias for backward compatibility
export type VerifyOtpRequest = VerifyOTPRequest;

// SkipMfaSetupRequest
export interface SkipMfaSetupRequest {
  email?: string;
  phone_number?: string;
  state?: string;
}

// LockMfaRequest
export interface LockMfaRequest {
  email?: string;
  phone_number?: string;
}

// OtpMfaSetupRequest
export interface OtpMfaSetupRequest {
  email?: string;
  phone_number?: string;
}

// WebAuthn / passkey types. `options`/`credential` are opaque JSON strings -
// the server's PublicKeyCredentialCreationOptionsJSON / RequestOptionsJSON on
// the way out, and the browser's RegistrationResponseJSON /
// AuthenticationResponseJSON (from PublicKeyCredential.toJSON()) on the way
// back in. See src/webauthn.ts for the browser ceremony glue.
export interface WebauthnRegistrationOptionsResponse {
  options: string;
}

export interface WebauthnRegistrationVerifyRequest {
  name?: string | null;
  credential: string;
  // email/phone_number/state are only used on the MFA-session-cookie path
  // (registering a passkey mid login-time MFA offer) — ignored for an
  // ordinary authenticated-settings-page caller.
  email?: string | null;
  phone_number?: string | null;
  state?: string | null;
}

export interface WebauthnLoginOptionsResponse {
  options: string;
}

export interface WebauthnLoginVerifyRequest {
  state?: string | null;
  credential: string;
}

export interface WebauthnCredentialInfo {
  id: string;
  name: string;
  transports?: string[] | null;
  created_at?: number | null;
  updated_at?: number | null;
  last_used_at?: number | null;
}

// ResendOTPRequest
export interface ResendOTPRequest {
  email?: string | null;
  phone_number?: string | null;
  state?: string | null;
}

// Keep ResendOtpRequest as alias for backward compatibility
export type ResendOtpRequest = ResendOTPRequest;

// UpdateProfileRequest
export interface UpdateProfileRequest {
  old_password?: string | null;
  new_password?: string | null;
  confirm_new_password?: string | null;
  email?: string | null;
  given_name?: string | null;
  family_name?: string | null;
  middle_name?: string | null;
  nickname?: string | null;
  gender?: string | null;
  birthdate?: string | null;
  phone_number?: string | null;
  picture?: string | null;
  is_multi_factor_auth_enabled?: boolean | null;
  app_data?: Record<string, any> | null;
}

// UpdateUserRequest (admin only)
export interface UpdateUserRequest {
  id: string;
  email?: string | null;
  email_verified?: boolean | null;
  given_name?: string | null;
  family_name?: string | null;
  middle_name?: string | null;
  nickname?: string | null;
  gender?: string | null;
  birthdate?: string | null;
  phone_number?: string | null;
  phone_number_verified?: boolean | null;
  picture?: string | null;
  roles?: string[] | null;
  is_multi_factor_auth_enabled?: boolean | null;
  app_data?: Record<string, any> | null;
  reset_mfa?: boolean;
}

// ForgotPasswordRequest
export interface ForgotPasswordRequest {
  email?: string | null;
  phone_number?: string | null;
  state?: string | null;
  redirect_uri?: string | null;
}

// ResetPasswordRequest
export interface ResetPasswordRequest {
  token?: string | null;
  otp?: string | null;
  phone_number?: string | null;
  password: string;
  confirm_password: string;
}

// Keep ResetPasswordInput as alias for backward compatibility
export type ResetPasswordInput = ResetPasswordRequest;

// DeleteUserRequest (admin only)
export interface DeleteUserRequest {
  email: string;
}

// Fine-grained authorization (FGA) types — the client-facing surface of
// Authorizer's embedded OpenFGA engine. Only the read-side operations a relying
// party needs are exposed: checking access and listing accessible objects.
// Authoring the authorization model and relationship tuples is an admin concern
// handled from the dashboard / `_fga_*` admin API, and is not part of this SDK.
//
// For every operation the subject defaults to the authenticated caller and is
// pinned server-side from the request (session cookie or bearer token). The
// optional `user` override ("type:id", or a bare id treated as "user:<id>")
// is honored only when the caller is a super-admin or when it equals the
// caller's own token subject; anything else is rejected by the server.

// FgaTupleInput is a single relationship tuple (user is related to object via
// relation), used to pass contextual tuples evaluated for one check only and
// never persisted.
export interface FgaTupleInput {
  user: string;
  relation: string;
  object: string;
}

// PermissionCheckInput is one permission to evaluate: "does the subject have
// `relation` on `object`?". Contextual tuples are evaluated for this check
// only and never persisted.
export interface PermissionCheckInput {
  relation: string;
  object: string;
  contextual_tuples?: FgaTupleInput[] | null;
}

// CheckPermissionsInput evaluates one or more permission checks in a single
// call. The subject defaults to the authenticated caller (JWT / session
// cookie). The optional `user` ("type:id", or a bare id treated as
// "user:<id>") is honored only when the caller is a super-admin OR it equals
// the caller's own token subject; anything else is rejected by the server —
// never silently ignored.
export interface CheckPermissionsInput {
  checks: PermissionCheckInput[];
  user?: string | null;
}

// PermissionCheckResult is the outcome of one permission check, echoing the
// checked pair so batch results are self-describing (and positionally aligned
// with the supplied `checks`).
export interface PermissionCheckResult {
  relation: string;
  object: string;
  allowed: boolean;
}

// CheckPermissionsResponse carries one result per supplied check, in order.
export interface CheckPermissionsResponse {
  results: PermissionCheckResult[];
}

// ListPermissionsInput enumerates the objects of `object_type` the subject
// holds `relation` on. Subject resolution (the optional `user` override)
// follows the same rules as CheckPermissionsInput.user.
export interface ListPermissionsInput {
  relation: string;
  object_type: string;
  user?: string | null;
}

// ListPermissionsResponse lists fully-qualified object ids (e.g. "document:1")
// the subject holds the queried permission on.
export interface ListPermissionsResponse {
  objects: string[];
}

// SessionQueryRequest
export interface SessionQueryRequest {
  roles?: string[] | null;
  scope?: string[] | null;
}

// Keep SessionQueryInput as alias for backward compatibility
export type SessionQueryInput = SessionQueryRequest;

// ValidateJWTTokenRequest
export interface ValidateJWTTokenRequest {
  token_type: string;
  token: string;
  roles?: string[] | null;
}

// Keep ValidateJWTTokenInput as alias for backward compatibility
export type ValidateJWTTokenInput = ValidateJWTTokenRequest;

// ValidateJWTTokenResponse
export interface ValidateJWTTokenResponse {
  is_valid: boolean;
  claims: Record<string, any>;
}

// ValidateSessionRequest
export interface ValidateSessionRequest {
  cookie: string;
  roles?: string[] | null;
}

// Keep ValidateSessionInput as alias for backward compatibility
export type ValidateSessionInput = ValidateSessionRequest;

// ValidateSessionResponse
export interface ValidateSessionResponse {
  is_valid: boolean;
  user: User;
}

// OAuth types (not part of GraphQL schema, but used for OAuth flow)
export enum OAuthProviders {
  Apple = 'apple',
  Github = 'github',
  Google = 'google',
  Facebook = 'facebook',
  LinkedIn = 'linkedin',
  Twitter = 'twitter',
  Microsoft = 'microsoft',
  Twitch = 'twitch',
  Roblox = 'roblox',
  Discord = 'discord',
}

export enum ResponseTypes {
  Code = 'code',
  Token = 'token',
}

export interface AuthorizeRequest {
  response_type: ResponseTypes;
  use_refresh_token?: boolean;
  response_mode?: string;
}

// Keep AuthorizeInput as alias for backward compatibility
export type AuthorizeInput = AuthorizeRequest;

export interface AuthorizeResponse {
  state: string;
  code?: string;
  error?: string;
  error_description?: string;
}

export interface RevokeTokenInput {
  refresh_token: string;
}

export interface GetTokenRequest {
  code?: string;
  grant_type?: string;
  refresh_token?: string;
  // --- client_credentials (RFC 6749 §4.4) — SERVER-SIDE ONLY ---
  // client_secret authenticates the service account. NEVER ship it in a
  // browser bundle.
  client_secret?: string;
  // scope is the space-delimited OAuth2 scope parameter (RFC 6749 §3.3);
  // omitted = the service account's full allowed scope set.
  scope?: string;
  // client_assertion / client_assertion_type carry the RFC 7523 JWT-bearer
  // client credential — the secretless workload-identity path (K8s SA
  // tokens, SPIFFE JWT-SVIDs, cloud OIDC tokens).
  client_assertion?: string;
  client_assertion_type?: string;
  // --- RFC 8693 token exchange (delegation) — SERVER-SIDE ONLY ---
  // subject_token carries the authority being exercised (the user's token);
  // actor_token carries the acting agent's token (its presence selects the
  // delegation profile). See TOKEN_TYPE_* constants for the *_token_type URNs.
  subject_token?: string;
  subject_token_type?: string;
  actor_token?: string;
  actor_token_type?: string;
  // resource is the RFC 8707 resource indicator the issued token is
  // audience-bound to.
  resource?: string;
}

// Keep GetTokenInput as alias for backward compatibility
export type GetTokenInput = GetTokenRequest;

export interface GetTokenResponse {
  access_token: string;
  expires_in: number;
  // id_token is only issued on user grants (authorization_code /
  // refresh_token) — absent for client_credentials and token exchange.
  id_token?: string;
  refresh_token?: string;
  token_type?: string;
  // scope / issued_token_type are returned by the client_credentials and
  // token-exchange grants (RFC 6749 §5.1 / RFC 8693 §2.2).
  scope?: string;
  issued_token_type?: string;
}

// GraphQL query request
export type Headers = Record<string, string>;

export interface GraphqlQueryRequest {
  query: string;
  variables?: Record<string, any>;
  headers?: Headers;
  /** When set, sent as the GraphQL `operationName` field; should match the named operation in `query` (schema field names, e.g. `forgot_password`). */
  operationName?: string;
}

// Deprecated types (for backward compatibility)
export interface IsValidJWTQueryInput {
  jwt: string;
  roles?: string[];
}

export interface ValidJWTResponse {
  valid: string;
  message: string;
}

// Keep MetaDataResponse as alias for backward compatibility
export type MetaDataResponse = Meta;

// Keep MetaData as alias for backward compatibility
export type MetaData = Meta;

// ============================================================================
// Admin API types (AuthorizerAdmin).
//
// These mirror the AuthorizerAdminService proto / `_`-prefixed GraphQL admin
// surface. Field names stay snake_case to match the rest of this SDK and the
// server's GraphQL/REST payloads. Every admin call authenticates with the
// `x-authorizer-admin-secret` header.
// ============================================================================

/**
 * AuthorizerAdmin configuration. Like {@link ConfigType}, requests target
 * `authorizerURL` (the exact, trusted origin of your Authorizer deployment).
 * The `adminSecret` is sent on every call via `x-authorizer-admin-secret`, so
 * only ever construct this in a trusted server-side context — never ship the
 * admin secret to a browser.
 */
export interface AdminConfigType {
  authorizerURL: string;
  adminSecret: string;
  extraHeaders?: Record<string, string>;
  /** `'graphql'` (default) or `'rest'`. `'grpc'` is not supported in JS. */
  protocol?: Protocol;
}

// PaginationRequest is the page/limit input shared by all paginated admin lists.
export interface PaginationRequest {
  limit?: number | null;
  page?: number | null;
}

// AdminLoginRequest authenticates the admin and establishes a session cookie.
export interface AdminLoginRequest {
  admin_secret: string;
}

// AdminMeta is admin-only configuration metadata (configured roles).
export interface AdminMeta {
  roles: string[];
  default_roles: string[];
  protected_roles: string[];
  is_multi_factor_auth_service_enabled: boolean;
}

// PaginatedRequest wraps the pagination input for list queries.
export interface PaginatedRequest {
  pagination?: PaginationRequest | null;
}

// ListUsersRequest is the admin _users query input. query is an optional
// case-insensitive substring filter matched against email, given_name,
// family_name and nickname. Empty/absent means no filter (full list).
export interface ListUsersRequest {
  pagination?: PaginationRequest | null;
  query?: string | null;
}

// GetUserRequest fetches a single user by id or email (at least one required).
export interface GetUserRequest {
  id?: string | null;
  email?: string | null;
}

// UpdateAccessRequest targets a single user id for revoke / enable access.
export interface UpdateAccessRequest {
  user_id: string;
}

// InviteMemberRequest invites a list of emails (requires a configured email service).
export interface InviteMemberRequest {
  emails: string[];
  redirect_uri?: string | null;
}

// Webhook mirrors the server Webhook model.
export interface Webhook {
  id: string;
  event_name: string | null;
  event_description: string | null;
  endpoint: string | null;
  enabled: boolean | null;
  headers: Record<string, any> | null;
  created_at: number | null;
  updated_at: number | null;
}

// Webhooks is a paginated list of webhooks.
export interface Webhooks {
  pagination: Pagination;
  webhooks: Webhook[];
}

// WebhookLog mirrors the server WebhookLog model.
export interface WebhookLog {
  id: string;
  http_status: number | null;
  response: string | null;
  request: string | null;
  webhook_id: string | null;
  created_at: number | null;
  updated_at: number | null;
}

// WebhookLogs is a paginated list of webhook delivery logs.
export interface WebhookLogs {
  pagination: Pagination;
  webhook_logs: WebhookLog[];
}

// AddWebhookRequest registers a new webhook.
export interface AddWebhookRequest {
  event_name: string;
  event_description?: string | null;
  endpoint: string;
  enabled: boolean;
  headers?: Record<string, any> | null;
}

// UpdateWebhookRequest updates an existing webhook.
export interface UpdateWebhookRequest {
  id: string;
  event_name?: string | null;
  event_description?: string | null;
  endpoint?: string | null;
  enabled?: boolean | null;
  headers?: Record<string, any> | null;
}

// WebhookRequest targets a single webhook by id (get / delete).
export interface WebhookRequest {
  id: string;
}

// ListWebhookLogRequest is a paginated, optionally-filtered webhook-log read.
export interface ListWebhookLogRequest {
  pagination?: PaginationRequest | null;
  webhook_id?: string | null;
}

// TestEndpointRequest sends a synthetic event payload to an endpoint.
export interface TestEndpointRequest {
  endpoint: string;
  event_name: string;
  event_description?: string | null;
  headers?: Record<string, any> | null;
}

// TestEndpointResponse carries the endpoint's HTTP status + body.
export interface TestEndpointResponse {
  http_status: number | null;
  response: string | null;
}

// EmailTemplate mirrors the server EmailTemplate model.
export interface EmailTemplate {
  id: string;
  event_name: string;
  template: string;
  design: string;
  subject: string;
  created_at: number | null;
  updated_at: number | null;
}

// EmailTemplates is a paginated list of email templates.
export interface EmailTemplates {
  pagination: Pagination;
  email_templates: EmailTemplate[];
}

// AddEmailTemplateRequest creates a new email template.
export interface AddEmailTemplateRequest {
  event_name: string;
  subject: string;
  template: string;
  design?: string | null;
}

// UpdateEmailTemplateRequest updates an existing email template.
export interface UpdateEmailTemplateRequest {
  id: string;
  event_name?: string | null;
  template?: string | null;
  subject?: string | null;
  design?: string | null;
}

// DeleteEmailTemplateRequest targets a single email template id.
export interface DeleteEmailTemplateRequest {
  id: string;
}

// AuditLog mirrors the server AuditLog model.
export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_type: string | null;
  actor_email: string | null;
  action: string | null;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: string | null;
  created_at: number | null;
}

// AuditLogs is a paginated list of audit log entries.
export interface AuditLogs {
  pagination: Pagination;
  audit_logs: AuditLog[];
}

// ListAuditLogRequest is a paginated, optionally-filtered audit-log read.
export interface ListAuditLogRequest {
  pagination?: PaginationRequest | null;
  action?: string | null;
  actor_id?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  from_timestamp?: number | null;
  to_timestamp?: number | null;
}

// FgaModel is a fine-grained authorization model (id + DSL form).
export interface FgaModel {
  id: string;
  dsl: string;
}

// FgaTuple is one persisted relationship tuple.
export interface FgaTuple {
  user: string;
  relation: string;
  object: string;
}

// FgaTuples is a page of tuples plus a continuation token (empty when exhausted).
export interface FgaTuples {
  tuples: FgaTuple[];
  continuation_token: string | null;
}

// FgaWriteModelInput installs a new authorization model from its DSL form.
export interface FgaWriteModelInput {
  dsl: string;
}

// FgaWriteTuplesInput is used for both writing and deleting tuples.
export interface FgaWriteTuplesInput {
  tuples: FgaTupleInput[];
}

// FgaReadTuplesInput is a paginated, optionally-filtered tuple read.
export interface FgaReadTuplesInput {
  user?: string | null;
  relation?: string | null;
  object?: string | null;
  page_size?: number | null;
  continuation_token?: string | null;
}

// FgaListUsersInput asks "which users of user_type have relation on object?".
export interface FgaListUsersInput {
  object: string;
  relation: string;
  user_type: string;
}

// FgaListUsersResponse lists fully-qualified user ids.
export interface FgaListUsersResponse {
  users: string[];
}

// FgaExpandInput asks for the relationship/userset tree of (relation, object).
export interface FgaExpandInput {
  relation: string;
  object: string;
}

// FgaExpandResponse is the OpenFGA relationship/userset tree as a JSON string.
export interface FgaExpandResponse {
  tree: string;
}

// GenerateJWTKeysRequest requests a fresh key pair / secret of the given type.
export interface GenerateJWTKeysRequest {
  type: string;
}

// GenerateJWTKeysResponse carries the generated secret / key pair.
export interface GenerateJWTKeysResponse {
  secret: string | null;
  public_key: string | null;
  private_key: string | null;
}

// AdminSignupRequest sets the admin secret on a fresh deployment (gql-only).
export interface AdminSignupRequest {
  admin_secret: string;
}

// ============================================================================
// Machine-agent-identity admin types: OAuth clients (service accounts),
// trusted issuers, organizations, org SSO connections, and SCIM endpoints.
// ============================================================================

// Client is a registered OAuth client / service account. client_secret is
// NEVER part of this shape — it is returned exactly once in
// CreateClientResponse (creation and rotation) and never again.
export interface Client {
  id: string;
  // client_id is the public OAuth identifier presented at the authorize/token
  // endpoints. Distinct from id (internal surrogate key); for a client
  // created via createClient (no way to set it separately), it defaults to
  // id server-side, but this MUST NOT be assumed to always equal id — pass
  // client_id, not id, wherever an OAuth client_id is expected (e.g.
  // getToken's client_credentials/token-exchange grants).
  client_id: string;
  name: string;
  description: string | null;
  allowed_scopes: string[];
  is_active: boolean;
  created_at: number | null;
  updated_at: number | null;
}

// CreateClientResponse carries the client plus its secret. The secret is
// returned ONCE at creation and ONCE at rotation; store it securely.
export interface CreateClientResponse {
  client: Client;
  client_secret: string;
}

// Clients is a paginated list of OAuth clients.
export interface Clients {
  pagination: Pagination;
  clients: Client[];
}

// CreateClientRequest registers a new OAuth client / service account.
export interface CreateClientRequest {
  name: string;
  description?: string | null;
  // allowed_scopes must contain at least one non-empty scope after trimming.
  allowed_scopes: string[];
}

// UpdateClientRequest updates an existing client. allowed_scopes, when
// supplied, replaces the scope set.
export interface UpdateClientRequest {
  id: string;
  name?: string | null;
  description?: string | null;
  allowed_scopes?: string[] | null;
  is_active?: boolean | null;
}

// ClientRequest targets a single client by id (get / delete / rotate secret).
export interface ClientRequest {
  id: string;
}

// ListClientsRequest is a paginated client list read.
export interface ListClientsRequest {
  pagination?: PaginationRequest | null;
}

// TrustedIssuer is an external token issuer trusted for secretless
// (client_assertion) authentication of a service account.
export interface TrustedIssuer {
  id: string;
  service_account_id: string;
  name: string;
  issuer_url: string;
  key_source_type: string;
  jwks_url: string | null;
  expected_aud: string;
  subject_claim: string;
  // allowed_subjects: comma-separated exact subject allow-list. Empty = deny-all.
  allowed_subjects: string | null;
  issuer_type: string;
  is_active: boolean;
  spiffe_refresh_hint_seconds: number | null;
  created_at: number | null;
  updated_at: number | null;
}

// TrustedIssuers is a paginated list of trusted issuers.
export interface TrustedIssuers {
  pagination: Pagination;
  trusted_issuers: TrustedIssuer[];
}

// AddTrustedIssuerRequest registers a trusted issuer for a service account.
export interface AddTrustedIssuerRequest {
  service_account_id: string;
  name: string;
  issuer_url: string;
  // key_source_type: "oidc_discovery" | "static_jwks_url" | "spiffe_bundle_endpoint"
  key_source_type: string;
  jwks_url?: string | null;
  expected_aud: string;
  // subject_claim defaults to "sub" if omitted.
  subject_claim?: string | null;
  // allowed_subjects: comma-separated exact subject allow-list. Empty/omitted
  // = deny-all — a row with no configured subjects authenticates nobody.
  allowed_subjects?: string | null;
  // issuer_type: "kubernetes_sa" | "spiffe_jwt" | "oidc" | "cloud_oidc"
  issuer_type: string;
  spiffe_refresh_hint_seconds?: number | null;
}

// UpdateTrustedIssuerRequest updates an existing trusted issuer.
export interface UpdateTrustedIssuerRequest {
  id: string;
  name?: string | null;
  jwks_url?: string | null;
  expected_aud?: string | null;
  allowed_subjects?: string | null;
  is_active?: boolean | null;
  spiffe_refresh_hint_seconds?: number | null;
}

// TrustedIssuerRequest targets a single trusted issuer by id (get / delete).
export interface TrustedIssuerRequest {
  id: string;
}

// ListTrustedIssuersRequest is a paginated, optionally service-account-scoped
// trusted issuer list read.
export interface ListTrustedIssuersRequest {
  service_account_id?: string | null;
  pagination?: PaginationRequest | null;
}

// Organization is a tenant grouping of users.
export interface Organization {
  id: string;
  // name is a unique, URL-safe slug identifying the organization.
  name: string;
  display_name: string | null;
  enabled: boolean;
  created_at: number | null;
  updated_at: number | null;
}

// Organizations is a paginated list of organizations.
export interface Organizations {
  pagination: Pagination;
  organizations: Organization[];
}

// CreateOrganizationRequest creates a new organization.
export interface CreateOrganizationRequest {
  // name must be a unique, URL-safe slug.
  name: string;
  display_name?: string | null;
}

// UpdateOrganizationRequest updates an existing organization.
export interface UpdateOrganizationRequest {
  id: string;
  name?: string | null;
  display_name?: string | null;
  enabled?: boolean | null;
}

// OrganizationRequest targets a single organization by id (get / delete).
export interface OrganizationRequest {
  id: string;
}

// ListOrganizationsRequest is a paginated organization list read.
export interface ListOrganizationsRequest {
  pagination?: PaginationRequest | null;
}

// OrgMember is a user's membership in an organization.
export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  // roles is the set of per-organization roles granted to this member.
  roles: string[];
  created_at: number | null;
  updated_at: number | null;
}

// OrgMembers is a paginated list of organization members.
export interface OrgMembers {
  pagination: Pagination;
  org_members: OrgMember[];
}

// AddOrgMemberRequest adds a user to an organization.
export interface AddOrgMemberRequest {
  org_id: string;
  user_id: string;
  // roles defaults to an empty set when omitted.
  roles?: string[] | null;
}

// RemoveOrgMemberRequest removes a user from an organization.
export interface RemoveOrgMemberRequest {
  org_id: string;
  user_id: string;
}

// ListOrgMembersRequest is a paginated member list read for one organization.
export interface ListOrgMembersRequest {
  org_id: string;
  pagination?: PaginationRequest | null;
}

// UserOrganization pairs an organization with the roles a specific user holds
// in it. Returned by the admin _user_organizations query.
export interface UserOrganization {
  organization: Organization;
  roles: string[];
}

// UserOrganizations is a paginated list of a user's organization memberships.
export interface UserOrganizations {
  pagination: Pagination;
  user_organizations: UserOrganization[];
}

// UserOrganizationsRequest lists the organizations a user belongs to, with the
// roles held per org.
export interface UserOrganizationsRequest {
  user_id: string;
  pagination?: PaginationRequest | null;
}

// OrgOIDCConnection is a per-organization upstream OIDC IdP that Authorizer
// brokers as a Relying Party. The upstream client_secret is NEVER projected.
export interface OrgOIDCConnection {
  id: string;
  org_id: string;
  name: string;
  issuer_url: string;
  // sso_client_id: the client_id Authorizer uses AT the upstream IdP.
  sso_client_id: string;
  scopes: string | null;
  redirect_uri: string | null;
  is_active: boolean;
  created_at: number | null;
  updated_at: number | null;
}

// CreateOrgOIDCConnectionRequest creates a per-org upstream OIDC connection.
export interface CreateOrgOIDCConnectionRequest {
  org_id: string;
  name: string;
  // issuer_url: the upstream IdP issuer (its OIDC discovery base).
  issuer_url: string;
  // client_id / client_secret: the credentials Authorizer holds AT the
  // upstream IdP. The secret is stored encrypted and never returned.
  client_id: string;
  client_secret: string;
  // scopes: space-separated. Defaults to "openid profile email" when omitted.
  scopes?: string | null;
  // redirect_uri registered at the upstream IdP. Derived from the request
  // host when omitted.
  redirect_uri?: string | null;
}

// UpdateOrgOIDCConnectionRequest updates a per-org upstream OIDC connection.
export interface UpdateOrgOIDCConnectionRequest {
  id: string;
  name?: string | null;
  issuer_url?: string | null;
  client_id?: string | null;
  // Supplying client_secret rotates it; omitting leaves the stored secret intact.
  client_secret?: string | null;
  scopes?: string | null;
  redirect_uri?: string | null;
  is_active?: boolean | null;
}

// OrgOIDCConnectionRequest looks up a connection by id OR by org_id
// (supply exactly one).
export interface OrgOIDCConnectionRequest {
  id?: string | null;
  org_id?: string | null;
}

// OrgSAMLConnection is a per-organization upstream SAML 2.0 IdP for which
// Authorizer acts as the Service Provider. The IdP signing certificate is
// accepted on write but never projected back.
export interface OrgSAMLConnection {
  id: string;
  org_id: string;
  name: string;
  // idp_entity_id: the upstream IdP entity ID (the assertion Issuer).
  idp_entity_id: string;
  // idp_sso_url: the IdP Single Sign-On endpoint the AuthnRequest is sent to.
  idp_sso_url: string | null;
  // sp_entity_id / acs_url: the SP identity Authorizer advertises for this
  // org. Empty means "derived from the request host".
  sp_entity_id: string | null;
  acs_url: string | null;
  // attribute_mapping: JSON mapping profile fields to SAML attribute names.
  attribute_mapping: string | null;
  // allow_idp_initiated: whether IdP-initiated SSO is permitted.
  allow_idp_initiated: boolean;
  is_active: boolean;
  created_at: number | null;
  updated_at: number | null;
}

// CreateOrgSAMLConnectionRequest creates a per-org upstream SAML connection.
export interface CreateOrgSAMLConnectionRequest {
  org_id: string;
  name: string;
  // idp_entity_id: the upstream IdP entity ID (matched against the assertion
  // Issuer). Globally unique across all trusted issuers.
  idp_entity_id: string;
  // idp_sso_url: the IdP Single Sign-On endpoint (HTTP-Redirect binding).
  idp_sso_url: string;
  // idp_certificate: the IdP X.509 signing certificate (PEM). Assertion
  // signatures are validated ONLY against this certificate.
  idp_certificate: string;
  // sp_entity_id / acs_url: override the host-derived SP identity. Optional.
  sp_entity_id?: string | null;
  acs_url?: string | null;
  // attribute_mapping: JSON, e.g. {"email":"email","given_name":"firstName"}.
  attribute_mapping?: string | null;
  // allow_idp_initiated: default false (SP-initiated only).
  allow_idp_initiated?: boolean | null;
}

// UpdateOrgSAMLConnectionRequest updates a per-org upstream SAML connection.
export interface UpdateOrgSAMLConnectionRequest {
  id: string;
  name?: string | null;
  idp_entity_id?: string | null;
  idp_sso_url?: string | null;
  // Supplying idp_certificate replaces it; omitting leaves the stored cert intact.
  idp_certificate?: string | null;
  sp_entity_id?: string | null;
  acs_url?: string | null;
  attribute_mapping?: string | null;
  allow_idp_initiated?: boolean | null;
  is_active?: boolean | null;
}

// OrgSAMLConnectionRequest looks up a connection by id OR by org_id
// (supply exactly one).
export interface OrgSAMLConnectionRequest {
  id?: string | null;
  org_id?: string | null;
}

// SAMLServiceProvider is a downstream SAML 2.0 SP that Authorizer (acting as
// the IdP) issues signed assertions to. This is the inverse of
// OrgSAMLConnection.
export interface SAMLServiceProvider {
  id: string;
  org_id: string;
  name: string;
  // entity_id: the SP entity ID (the AuthnRequest Issuer and assertion Audience).
  entity_id: string;
  // acs_url: the SP Assertion Consumer Service URL — the only place assertions
  // are POSTed. Never taken from the request.
  acs_url: string;
  // sp_cert_pem: the SP's optional X.509 signing certificate (PEM).
  sp_cert_pem: string | null;
  // name_id_format: SAML NameID format for the Subject (default emailAddress).
  name_id_format: string | null;
  // mapped_attributes: JSON mapping profile fields to emitted SAML attribute names.
  mapped_attributes: string | null;
  // allow_idp_initiated: whether unsolicited IdP-initiated SSO is permitted.
  allow_idp_initiated: boolean;
  is_active: boolean;
  created_at: number | null;
  updated_at: number | null;
}

// SAMLServiceProviders is a paginated list of downstream SAML SPs for an org.
export interface SAMLServiceProviders {
  pagination: Pagination;
  saml_service_providers: SAMLServiceProvider[];
}

// CreateSAMLServiceProviderRequest registers a downstream SP.
export interface CreateSAMLServiceProviderRequest {
  org_id: string;
  name: string;
  entity_id: string;
  acs_url: string;
  sp_cert_pem?: string | null;
  // name_id_format: default urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress.
  name_id_format?: string | null;
  mapped_attributes?: string | null;
  // allow_idp_initiated: default false (SP-initiated only).
  allow_idp_initiated?: boolean | null;
}

// UpdateSAMLServiceProviderRequest updates an existing downstream SP.
export interface UpdateSAMLServiceProviderRequest {
  id: string;
  name?: string | null;
  entity_id?: string | null;
  acs_url?: string | null;
  sp_cert_pem?: string | null;
  name_id_format?: string | null;
  mapped_attributes?: string | null;
  allow_idp_initiated?: boolean | null;
  is_active?: boolean | null;
}

// SAMLServiceProviderRequest looks up (or deletes) a single downstream SP by id.
export interface SAMLServiceProviderRequest {
  id: string;
}

// ListSAMLServiceProvidersRequest is a paginated read of one org's downstream SPs.
export interface ListSAMLServiceProvidersRequest {
  org_id: string;
  pagination?: PaginationRequest | null;
}

// SAMLIDPKey is a per-org SAML IdP signing keypair. The private key is NEVER
// projected — only the certificate and rotation status.
export interface SAMLIDPKey {
  id: string;
  org_id: string;
  // cert_pem: the self-signed X.509 signing certificate (PEM), pinned by SPs.
  cert_pem: string;
  algorithm: string;
  // status: "current" (signs new assertions), "active" (published in metadata,
  // not signing), or "retired" (neither).
  status: string;
  created_at: number | null;
  updated_at: number | null;
}

// RotateSAMLIDPCertRequest generates a new current signing keypair for an
// org's SAML IdP, demoting the previous current key.
export interface RotateSAMLIDPCertRequest {
  org_id: string;
}

// RetireSAMLIDPKeyRequest retires a published-but-superseded key by id.
// Cannot retire the current key.
export interface RetireSAMLIDPKeyRequest {
  id: string;
}

// ListSAMLIDPKeysRequest lists all SAML IdP signing keys for an org (unpaginated).
export interface ListSAMLIDPKeysRequest {
  org_id: string;
}

// SAMLSPMetadataParseResult is the parsed output of importSAMLSPMetadata. It
// does NOT create a record — it returns fields to prefill a create call.
export interface SAMLSPMetadataParseResult {
  entity_id: string;
  acs_url: string;
  certificate: string | null;
}

// ImportSAMLSPMetadataRequest parses pasted SP metadata XML (NOT a URL — no
// remote fetch).
export interface ImportSAMLSPMetadataRequest {
  metadata_xml: string;
}

// ScimEndpoint is the per-org inbound SCIM 2.0 connection credential. The
// bearer token is NEVER part of this shape — it is returned exactly once in
// CreateScimEndpointResponse (creation and rotation) and never again.
export interface ScimEndpoint {
  id: string;
  org_id: string;
  enabled: boolean;
  created_at: number | null;
  updated_at: number | null;
}

// CreateScimEndpointResponse carries the endpoint plus its bearer token. The
// token is returned ONCE at creation and ONCE at rotation; store it securely.
export interface CreateScimEndpointResponse {
  scim_endpoint: ScimEndpoint;
  token: string;
}

// CreateScimEndpointRequest / ScimEndpointRequest are keyed by org_id — one
// SCIM endpoint per org.
export interface CreateScimEndpointRequest {
  org_id: string;
}

export interface ScimEndpointRequest {
  org_id: string;
}

// OrgDomain is a VERIFIED mapping from a DNS domain to exactly one organization,
// used for home-realm discovery. A row exists ONLY once the domain is verified.
export interface OrgDomain {
  domain: string;
  org_id: string;
  verified_at: number | null;
  created_at: number | null;
  updated_at: number | null;
}

// OrgDomains is a paginated list of an organization's verified domains.
export interface OrgDomains {
  pagination: Pagination;
  org_domains: OrgDomain[];
}

// OrgDomainChallenge is the DNS TXT record a tenant must publish to prove
// control of a domain. Returned by _request_org_domain; no durable row exists
// until the domain is verified.
export interface OrgDomainChallenge {
  domain: string;
  // record_type is always "TXT".
  record_type: string;
  // record_name is the DNS name to create, e.g. _authorizer-challenge.acme.com
  record_name: string;
  // record_value is the exact TXT value to publish.
  record_value: string;
}

// RequestOrgDomainRequest starts domain verification for an org, returning the
// DNS challenge to publish.
export interface RequestOrgDomainRequest {
  org_id: string;
  domain: string;
}

// VerifyOrgDomainRequest checks the published DNS challenge and, on success,
// records the verified domain.
export interface VerifyOrgDomainRequest {
  org_id: string;
  domain: string;
}

// AddVerifiedOrgDomainRequest records a verified domain without a DNS challenge
// (super-admin only, trusted-assert).
export interface AddVerifiedOrgDomainRequest {
  org_id: string;
  domain: string;
}

// ListOrgDomainsRequest is a paginated read of one organization's verified domains.
export interface ListOrgDomainsRequest {
  org_id: string;
  pagination?: PaginationRequest | null;
}

// DeleteOrgDomainRequest removes a verified domain (keyed by domain alone).
export interface DeleteOrgDomainRequest {
  domain: string;
}
