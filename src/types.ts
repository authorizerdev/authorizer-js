export type ConfigType = {
	authorizerURL: string;
	redirectURL: string;
	clientID: string;
	extraHeaders?: Record<string, string>;
};

export type User = {
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
};

export type AuthToken = {
	message?: string;
	access_token: string;
	expires_in: number;
	id_token: string;
	refresh_token?: string;
	user?: User;
	should_show_otp_screen?: boolean;
};

export type Response = {
	message: string;
};

export type Headers = Record<string, string>;

export type LoginInput = {
	email: string;
	password: string;
	roles?: string[];
	scope?: string[];
};

export type SignupInput = {
	email: string;
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
};

export type MagicLinkLoginInput = {
	email: string;
	roles?: string[];
	scopes?: string[];
	state?: string;
	redirect_uri?: string;
};

export type VerifyEmailInput = { token: string };

export type VerifyOtpInput = { email: string; otp: string };

export type ResendOtpInput = { email: string };

export type GraphqlQueryInput = {
	query: string;
	variables?: Record<string, any>;
	headers?: Headers;
};

export type MetaData = {
	version: string;
	client_id: string;
	is_google_login_enabled: boolean;
	is_facebook_login_enabled: boolean;
	is_github_login_enabled: boolean;
	is_linkedin_login_enabled: boolean;
	is_apple_login_enabled: boolean;
	is_twitter_login_enabled: boolean;
	is_email_verification_enabled: boolean;
	is_basic_authentication_enabled: boolean;
	is_magic_link_login_enabled: boolean;
	is_sign_up_enabled: boolean;
	is_strong_password_enabled: boolean;
};

export type UpdateProfileInput = {
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
};

export type ForgotPasswordInput = {
	email: string;
	state?: string;
	redirect_uri?: string;
};

export type ResetPasswordInput = {
	token: string;
	password: string;
	confirm_password: string;
};

export type SessionQueryInput = {
	roles?: string[];
};

export type IsValidJWTQueryInput = {
	jwt: string;
	roles?: string[];
};

export type ValidJWTResponse = {
	valid: string;
	message: string;
};

export enum OAuthProviders {
	Apple = 'apple',
	Github = 'github',
	Google = 'google',
	Facebook = 'facebook',
	LinkedIn = 'linkedin',
}

export enum ResponseTypes {
	Code = 'code',
	Token = 'token',
}

export type AuthorizeInput = {
	response_type: ResponseTypes;
	use_refresh_token?: boolean;
	response_mode?: string;
};

export type AuthorizeResponse = {
	state: string;
	code?: string;
	error?: string;
	error_description?: string;
};

export type RevokeTokenInput = {
	refresh_token: string;
};

export type GetTokenInput = {
	code?: string;
	grant_type?: string;
	refresh_token?: string;
};

export type GetTokenResponse = {
	access_token: string;
	expires_in: number;
	id_token: string;
	refresh_token?: string;
};

export type ValidateJWTTokenInput = {
	token_type: 'access_token' | 'id_token' | 'refresh_token';
	token: string;
	roles?: string[];
};

export type ValidateJWTTokenResponse = {
	is_valid: boolean;
};
