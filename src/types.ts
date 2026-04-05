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
}

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
