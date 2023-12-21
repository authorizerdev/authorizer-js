export interface GrapQlResponseType {
  data: any | undefined;
  errors: Error[];
}
export interface ApiResponse<T> {
  errors: Error[];
  data: T | undefined;
}
export interface ConfigType {
  authorizerURL: string;
  redirectURL: string;
  clientID: string;
  extraHeaders?: Record<string, string>;
}

export interface User {
  id: string;
  email: string;
  preferred_username: string;
  email_verified: boolean;
  signup_methods: string;
  given_name?: string | null;
  family_name?: string | null;
  middle_name?: string | null;
  nickname?: string | null;
  picture?: string | null;
  gender?: string | null;
  birthdate?: string | null;
  phone_number?: string | null;
  phone_number_verified?: boolean | null;
  roles?: string[];
  created_at: number;
  updated_at: number;
  is_multi_factor_auth_enabled?: boolean;
  app_data?: Record<string, any>;
}

export interface AuthToken {
  message?: string;
  access_token: string;
  expires_in: number;
  id_token: string;
  refresh_token?: string;
  user?: User;
  should_show_email_otp_screen?: boolean;
  should_show_mobile_otp_screen?: boolean;
  should_show_totp_screen?: boolean;
  authenticator_scanner_image?: string;
  authenticator_secret?: string;
  authenticator_recovery_codes?: string[];
}

export interface GenericResponse {
  message: string;
}

export type Headers = Record<string, string>;

export interface LoginInput {
  email?: string;
  phone_number?: string;
  password: string;
  roles?: string[];
  scope?: string[];
  state?: string;
}

export interface SignupInput {
  email?: string;
  password: string;
  confirm_password: string;
  given_name?: string;
  family_name?: string;
  middle_name?: string;
  nickname?: string;
  picture?: string;
  gender?: string;
  birthdate?: string;
  phone_number?: string;
  roles?: string[];
  scope?: string[];
  redirect_uri?: string;
  is_multi_factor_auth_enabled?: boolean;
  state?: string;
  app_data?: Record<string, any>;
}

export interface MagicLinkLoginInput {
  email: string;
  roles?: string[];
  scopes?: string[];
  state?: string;
  redirect_uri?: string;
}

export interface VerifyEmailInput {
  token: string;
  state?: string;
}

export interface ResendVerifyEmailInput {
  email: string;
  identifier: string;
}

export interface VerifyOtpInput {
  email?: string;
  phone_number?: string;
  otp: string;
  state?: string;
  is_totp?: boolean;
}

export interface ResendOtpInput {
  email?: string;
  phone_number?: string;
}

export interface GraphqlQueryInput {
  query: string;
  variables?: Record<string, any>;
  headers?: Headers;
}

export interface MetaData {
  version: string;
  client_id: string;
  is_google_login_enabled: boolean;
  is_facebook_login_enabled: boolean;
  is_github_login_enabled: boolean;
  is_linkedin_login_enabled: boolean;
  is_apple_login_enabled: boolean;
  is_twitter_login_enabled: boolean;
  is_microsoft_login_enabled: boolean;
  is_twitch_login_enabled: boolean;
  is_email_verification_enabled: boolean;
  is_basic_authentication_enabled: boolean;
  is_magic_link_login_enabled: boolean;
  is_sign_up_enabled: boolean;
  is_strong_password_enabled: boolean;
  is_multi_factor_auth_enabled: boolean;
  is_mobile_basic_authentication_enabled: boolean;
  is_phone_verification_enabled: boolean;
}

export interface UpdateProfileInput {
  old_password?: string;
  new_password?: string;
  confirm_new_password?: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  middle_name?: string;
  nickname?: string;
  gender?: string;
  birthdate?: string;
  phone_number?: string;
  picture?: string;
  is_multi_factor_auth_enabled?: boolean;
  app_data?: Record<string, any>;
}

export interface ForgotPasswordInput {
  email?: string;
  phone_number?: string;
  state?: string;
  redirect_uri?: string;
}

export interface ForgotPasswordResponse {
  message: string;
  should_show_mobile_otp_screen?: boolean;
}

export interface ResetPasswordInput {
  token?: string;
  otp?: string;
  phone_number?: string;
  password: string;
  confirm_password: string;
}

export interface SessionQueryInput {
  roles?: string[];
}

export interface IsValidJWTQueryInput {
  jwt: string;
  roles?: string[];
}

export interface ValidJWTResponse {
  valid: string;
  message: string;
}

export enum OAuthProviders {
  Apple = 'apple',
  Github = 'github',
  Google = 'google',
  Facebook = 'facebook',
  LinkedIn = 'linkedin',
  Twitter = 'twitter',
  Microsoft = 'microsoft',
  Twitch = 'twitch',
}

export enum ResponseTypes {
  Code = 'code',
  Token = 'token',
}

export interface AuthorizeInput {
  response_type: ResponseTypes;
  use_refresh_token?: boolean;
  response_mode?: string;
}

export interface AuthorizeResponse {
  state: string;
  code?: string;
  error?: string;
  error_description?: string;
}

export interface RevokeTokenInput {
  refresh_token: string;
}

export interface GetTokenInput {
  code?: string;
  grant_type?: string;
  refresh_token?: string;
}

export interface GetTokenResponse {
  access_token: string;
  expires_in: number;
  id_token: string;
  refresh_token?: string;
}

export interface ValidateJWTTokenInput {
  token_type: 'access_token' | 'id_token' | 'refresh_token';
  token: string;
  roles?: string[];
}

export interface ValidateJWTTokenResponse {
  is_valid: boolean;
  claims: Record<string, any>;
}

export interface ValidateSessionInput {
  cookie?: string;
  roles?: string[];
}

export interface ValidateSessionResponse {
  is_valid: boolean;
  user: User;
}
