import * as Types from './types';
import type { ApiResponse, AuthToken, AuthorizeResponse, ConfigType, GetTokenResponse, MetaData, User, ValidateJWTTokenResponse, ValidateSessionResponse, GenericResponse } from './types';
export * from './types';
export declare class Authorizer {
    config: ConfigType;
    codeVerifier: string;
    constructor(config: ConfigType);
    authorize: (data: Types.AuthorizeInput) => Promise<ApiResponse<GetTokenResponse> | ApiResponse<AuthorizeResponse>>;
    browserLogin: () => Promise<ApiResponse<AuthToken>>;
    forgotPassword: (data: Types.ForgotPasswordInput) => Promise<ApiResponse<GenericResponse>>;
    getMetaData: () => Promise<ApiResponse<MetaData>>;
    getProfile: (headers?: Types.Headers) => Promise<ApiResponse<User>>;
    getSession: (headers?: Types.Headers, params?: Types.SessionQueryInput) => Promise<ApiResponse<AuthToken>>;
    getToken: (data: Types.GetTokenInput) => Promise<ApiResponse<GetTokenResponse>>;
    login: (data: Types.LoginInput) => Promise<ApiResponse<AuthToken>>;
    logout: (headers?: Types.Headers) => Promise<ApiResponse<GenericResponse>>;
    magicLinkLogin: (data: Types.MagicLinkLoginInput) => Promise<ApiResponse<GenericResponse>>;
    oauthLogin: (oauthProvider: string, roles?: string[], redirect_uri?: string, state?: string) => Promise<void>;
    resendOtp: (data: Types.ResendOtpInput) => Promise<ApiResponse<GenericResponse>>;
    resetPassword: (data: Types.ResetPasswordInput) => Promise<ApiResponse<GenericResponse>>;
    revokeToken: (data: {
        refresh_token: string;
    }) => Promise<Types.ApiResponse<any>>;
    signup: (data: Types.SignupInput) => Promise<ApiResponse<AuthToken>>;
    updateProfile: (data: Types.UpdateProfileInput, headers?: Types.Headers) => Promise<ApiResponse<GenericResponse>>;
    deactivateAccount: (headers?: Types.Headers) => Promise<ApiResponse<GenericResponse>>;
    validateJWTToken: (params?: Types.ValidateJWTTokenInput) => Promise<ApiResponse<ValidateJWTTokenResponse>>;
    validateSession: (params?: Types.ValidateSessionInput) => Promise<ApiResponse<ValidateSessionResponse>>;
    verifyEmail: (data: Types.VerifyEmailInput) => Promise<ApiResponse<AuthToken>>;
    verifyOtp: (data: Types.VerifyOtpInput) => Promise<ApiResponse<AuthToken>>;
    private graphqlQuery;
    private errorResponse;
    private okResponse;
}
