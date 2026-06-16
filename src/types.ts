export interface GrapQlResponseType {
  data: any | undefined;
  errors: Error[];
}
export interface ApiResponse<T> {
  errors: Error[];
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
}

// Keep GetTokenInput as alias for backward compatibility
export type GetTokenInput = GetTokenRequest;

export interface GetTokenResponse {
  access_token: string;
  expires_in: number;
  id_token: string;
  refresh_token?: string;
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
}

// PaginatedRequest wraps the pagination input for list queries.
export interface PaginatedRequest {
  pagination?: PaginationRequest | null;
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
