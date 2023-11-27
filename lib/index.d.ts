interface GrapQlResponseType {
    data: any | undefined;
    errors: Error[];
}
interface ApiResponse<T> {
    ok: boolean;
    errors: Error[];
    data: T | undefined;
}
interface ConfigType {
    authorizerURL: string;
    redirectURL: string;
    clientID: string;
    extraHeaders?: Record<string, string>;
}
interface User {
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
interface AuthToken {
    message?: string;
    access_token: string;
    expires_in: number;
    id_token: string;
    refresh_token?: string;
    user?: User;
    should_show_email_otp_screen?: boolean;
    should_show_mobile_otp_screen?: boolean;
}
interface GenericResponse {
    message: string;
}
type Headers = Record<string, string>;
interface LoginInput {
    email?: string;
    phone_number?: string;
    password: string;
    roles?: string[];
    scope?: string[];
    state?: string;
}
interface SignupInput {
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
interface MagicLinkLoginInput {
    email: string;
    roles?: string[];
    scopes?: string[];
    state?: string;
    redirect_uri?: string;
}
interface VerifyEmailInput {
    token: string;
    state?: string;
}
interface ResendVerifyEmailInput {
    email: string;
    identifier: string;
}
interface VerifyOtpInput {
    email?: string;
    phone_number?: string;
    otp: string;
    state?: string;
}
interface ResendOtpInput {
    email?: string;
    phone_number?: string;
}
interface GraphqlQueryInput {
    query: string;
    variables?: Record<string, any>;
    headers?: Headers;
}
interface MetaData {
    version: string;
    client_id: string;
    is_google_login_enabled: boolean;
    is_facebook_login_enabled: boolean;
    is_github_login_enabled: boolean;
    is_linkedin_login_enabled: boolean;
    is_apple_login_enabled: boolean;
    is_twitter_login_enabled: boolean;
    is_microsoft_login_enabled: boolean;
    is_email_verification_enabled: boolean;
    is_basic_authentication_enabled: boolean;
    is_magic_link_login_enabled: boolean;
    is_sign_up_enabled: boolean;
    is_strong_password_enabled: boolean;
}
interface UpdateProfileInput {
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
interface ForgotPasswordInput {
    email: string;
    state?: string;
    redirect_uri?: string;
}
interface ResetPasswordInput {
    token: string;
    password: string;
    confirm_password: string;
}
interface SessionQueryInput {
    roles?: string[];
}
interface IsValidJWTQueryInput {
    jwt: string;
    roles?: string[];
}
interface ValidJWTResponse {
    valid: string;
    message: string;
}
declare enum OAuthProviders {
    Apple = "apple",
    Github = "github",
    Google = "google",
    Facebook = "facebook",
    LinkedIn = "linkedin"
}
declare enum ResponseTypes {
    Code = "code",
    Token = "token"
}
interface AuthorizeInput {
    response_type: ResponseTypes;
    use_refresh_token?: boolean;
    response_mode?: string;
}
interface AuthorizeResponse {
    state: string;
    code?: string;
    error?: string;
    error_description?: string;
}
interface RevokeTokenInput {
    refresh_token: string;
}
interface GetTokenInput {
    code?: string;
    grant_type?: string;
    refresh_token?: string;
}
interface GetTokenResponse {
    access_token: string;
    expires_in: number;
    id_token: string;
    refresh_token?: string;
}
interface ValidateJWTTokenInput {
    token_type: 'access_token' | 'id_token' | 'refresh_token';
    token: string;
    roles?: string[];
}
interface ValidateJWTTokenResponse {
    is_valid: boolean;
    claims: Record<string, any>;
}
interface ValidateSessionInput {
    cookie?: string;
    roles?: string[];
}
interface ValidateSessionResponse {
    is_valid: boolean;
    user: User;
}

declare class Authorizer {
    config: ConfigType;
    codeVerifier: string;
    constructor(config: ConfigType);
    authorize: (data: AuthorizeInput) => Promise<ApiResponse<GetTokenResponse> | ApiResponse<AuthorizeResponse>>;
    browserLogin: () => Promise<ApiResponse<AuthToken>>;
    forgotPassword: (data: ForgotPasswordInput) => Promise<ApiResponse<GenericResponse>>;
    getMetaData: () => Promise<ApiResponse<MetaData>>;
    getProfile: (headers?: Headers) => Promise<ApiResponse<User>>;
    getSession: (headers?: Headers, params?: SessionQueryInput) => Promise<ApiResponse<AuthToken>>;
    getToken: (data: GetTokenInput) => Promise<ApiResponse<GetTokenResponse>>;
    login: (data: LoginInput) => Promise<ApiResponse<AuthToken>>;
    logout: (headers?: Headers) => Promise<ApiResponse<GenericResponse>>;
    magicLinkLogin: (data: MagicLinkLoginInput) => Promise<ApiResponse<GenericResponse>>;
    oauthLogin: (oauthProvider: string, roles?: string[], redirect_uri?: string, state?: string) => Promise<void>;
    resendOtp: (data: ResendOtpInput) => Promise<ApiResponse<GenericResponse>>;
    resetPassword: (data: ResetPasswordInput) => Promise<ApiResponse<GenericResponse>>;
    revokeToken: (data: {
        refresh_token: string;
    }) => Promise<ApiResponse<any>>;
    signup: (data: SignupInput) => Promise<ApiResponse<AuthToken>>;
    updateProfile: (data: UpdateProfileInput, headers?: Headers) => Promise<ApiResponse<GenericResponse>>;
    deactivateAccount: (headers?: Headers) => Promise<ApiResponse<GenericResponse>>;
    validateJWTToken: (params?: ValidateJWTTokenInput) => Promise<ApiResponse<ValidateJWTTokenResponse>>;
    validateSession: (params?: ValidateSessionInput) => Promise<ApiResponse<ValidateSessionResponse>>;
    verifyEmail: (data: VerifyEmailInput) => Promise<ApiResponse<AuthToken>>;
    resendVerifyEmail: (data: ResendVerifyEmailInput) => Promise<ApiResponse<GenericResponse>>;
    verifyOtp: (data: VerifyOtpInput) => Promise<ApiResponse<AuthToken>>;
    private graphqlQuery;
    private errorResponse;
    private okResponse;
}

export { ApiResponse, AuthToken, AuthorizeInput, AuthorizeResponse, Authorizer, ConfigType, ForgotPasswordInput, GenericResponse, GetTokenInput, GetTokenResponse, GrapQlResponseType, GraphqlQueryInput, Headers, IsValidJWTQueryInput, LoginInput, MagicLinkLoginInput, MetaData, OAuthProviders, ResendOtpInput, ResendVerifyEmailInput, ResetPasswordInput, ResponseTypes, RevokeTokenInput, SessionQueryInput, SignupInput, UpdateProfileInput, User, ValidJWTResponse, ValidateJWTTokenInput, ValidateJWTTokenResponse, ValidateSessionInput, ValidateSessionResponse, VerifyEmailInput, VerifyOtpInput };
