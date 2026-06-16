// Note: write gql query in single line to reduce bundle size
import crossFetch from 'cross-fetch';
import { DEFAULT_AUTHORIZE_TIMEOUT_IN_SECONDS } from './constants';
import * as Types from './types';
import {
  bufferToBase64UrlEncoded,
  coerceInt64Fields,
  createQueryParams,
  createRandomString,
  encode,
  executeIframe,
  hasWindow,
  sha256,
  trimURL,
} from './utils';

// re-usable gql response fragment
const userFragment =
  'id email email_verified given_name family_name middle_name nickname preferred_username picture signup_methods gender birthdate phone_number phone_number_verified roles created_at updated_at revoked_timestamp is_multi_factor_auth_enabled app_data';
const authTokenFragment = `message access_token expires_in refresh_token id_token should_show_email_otp_screen should_show_mobile_otp_screen should_show_totp_screen authenticator_scanner_image authenticator_secret authenticator_recovery_codes user { ${userFragment} }`;

// set fetch based on window object. Cross fetch have issues with umd build
const getFetcher = () => (hasWindow() ? window.fetch : crossFetch);

function toErrorList(errors: unknown): Error[] {
  if (Array.isArray(errors)) {
    return errors.map((item) => {
      if (item instanceof Error) return item;
      if (item && typeof item === 'object' && 'message' in item)
        return new Error(String((item as { message: unknown }).message));
      return new Error(String(item));
    });
  }
  if (errors instanceof Error) return [errors];
  if (errors !== null && typeof errors === 'object') {
    const o = errors as Record<string, unknown>;
    if (typeof o.error_description === 'string')
      return [new Error(o.error_description)];
    if (typeof o.error === 'string') {
      const desc =
        typeof o.error_description === 'string'
          ? `: ${o.error_description}`
          : '';
      return [new Error(`${o.error}${desc}`)];
    }
    if (typeof o.message === 'string') return [new Error(o.message)];
  }
  if (errors === undefined || errors === null)
    return [new Error('Unknown error')];
  return [new Error(String(errors))];
}

export * from './types';
export { AuthorizerAdmin } from './admin';

/**
 * Client for the Authorizer API. All network calls go to `config.authorizerURL`
 * with cookies included where the runtime allows; only configure URLs you trust.
 */
export class Authorizer {
  // class variable
  config: Types.ConfigType;
  codeVerifier: string;

  // constructor
  constructor(config: Types.ConfigType) {
    if (!config) throw new Error('Configuration is required');

    this.config = config;
    if (!config.authorizerURL?.trim()) throw new Error('Invalid authorizerURL');

    this.config.authorizerURL = trimURL(config.authorizerURL);

    if (!config.redirectURL?.trim()) throw new Error('Invalid redirectURL');
    this.config.redirectURL = trimURL(config.redirectURL);
    this.config.clientID = (config?.clientID || '').trim();

    if ((config.protocol as string) === 'grpc')
      throw new Error(
        'protocol \'grpc\' is not supported in authorizer-js (browsers cannot speak raw gRPC); use \'graphql\' or \'rest\'',
      );
    this.config.protocol = config.protocol || 'graphql';

    this.config.extraHeaders = {
      ...(config.extraHeaders || {}),
      'x-authorizer-url': config.authorizerURL,
      'x-authorizer-client-id': config.clientID || '',
      'Content-Type': 'application/json',
    };
  }

  authorize = async (
    data: Types.AuthorizeRequest,
  ): Promise<
    | Types.ApiResponse<Types.GetTokenResponse>
    | Types.ApiResponse<Types.AuthorizeResponse>
  > => {
    if (!hasWindow())
      return this.errorResponse([
        new Error('this feature is only supported in browser'),
      ]);

    const scopes = ['openid', 'profile', 'email'];
    if (data.use_refresh_token) scopes.push('offline_access');

    const requestData: Record<string, string> = {
      redirect_uri: this.config.redirectURL,
      response_mode: data.response_mode || 'web_message',
      state: encode(createRandomString()),
      nonce: encode(createRandomString()),
      response_type: data.response_type,
      scope: scopes.join(' '),
      client_id: this.config?.clientID || '',
    };

    if (data.response_type === Types.ResponseTypes.Code) {
      this.codeVerifier = createRandomString();
      const sha = await sha256(this.codeVerifier);
      const codeChallenge = bufferToBase64UrlEncoded(sha);
      requestData.code_challenge = codeChallenge;
      requestData.code_challenge_method = 'S256';
    }

    const authorizeURL = `${
      this.config.authorizerURL
    }/authorize?${createQueryParams(requestData)}`;

    if (requestData.response_mode !== 'web_message') {
      window.location.replace(authorizeURL);
      return this.okResponse(undefined);
    }

    try {
      const iframeRes = await executeIframe(
        authorizeURL,
        this.config.authorizerURL,
        DEFAULT_AUTHORIZE_TIMEOUT_IN_SECONDS,
      );

      if (data.response_type === Types.ResponseTypes.Code) {
        // get token and return it
        const tokenResp: Types.ApiResponse<Types.GetTokenResponse> =
          await this.getToken({
            code: iframeRes.code,
          });
        return tokenResp.errors.length
          ? this.errorResponse(tokenResp.errors)
          : this.okResponse(tokenResp.data);
      }

      // this includes access_token, id_token & refresh_token(optionally)
      return this.okResponse(iframeRes);
    } catch (err) {
      if (err.error) {
        window.location.replace(
          `${this.config.authorizerURL}/app?state=${encode(
            JSON.stringify({
              clientID: this.config.clientID,
              redirectURL: this.config.redirectURL,
              authorizerURL: this.config.authorizerURL,
            }),
          )}&redirect_uri=${encodeURIComponent(this.config.redirectURL || '')}`,
        );
      }

      return this.errorResponse(err);
    }
  };

  browserLogin = async (): Promise<Types.ApiResponse<Types.AuthToken>> => {
    try {
      const tokenResp: Types.ApiResponse<Types.AuthToken> =
        await this.getSession();
      return tokenResp.errors.length
        ? this.errorResponse(tokenResp.errors)
        : this.okResponse(tokenResp.data);
    } catch (err) {
      if (!hasWindow()) {
        return {
          data: undefined,
          errors: [new Error('browserLogin is only supported for browsers')],
        };
      }

      window.location.replace(
        `${this.config.authorizerURL}/app?state=${encode(
          JSON.stringify({
            clientID: this.config.clientID,
            redirectURL: this.config.redirectURL,
            authorizerURL: this.config.authorizerURL,
          }),
        )}&redirect_uri=${encodeURIComponent(this.config.redirectURL || '')}`,
      );
      return this.errorResponse(err);
    }
  };

  forgotPassword = async (
    data: Types.ForgotPasswordRequest,
  ): Promise<Types.ApiResponse<Types.ForgotPasswordResponse>> => {
    if (!data.state) data.state = encode(createRandomString());

    if (!data.redirect_uri) data.redirect_uri = this.config.redirectURL;

    try {
      const forgotPasswordResp = await this.dispatch(
        'forgotPassword',
        ['graphql', 'rest'],
        {
          query:
            'mutation forgot_password($data: ForgotPasswordRequest!) {	forgot_password(params: $data) { message should_show_mobile_otp_screen } }',
          operationName: 'forgot_password',
          op: 'forgot_password',
        },
        { method: 'POST', path: '/v1/forgot_password', body: data },
        { data },
      );
      return forgotPasswordResp?.errors?.length
        ? this.errorResponse(forgotPasswordResp.errors)
        : this.okResponse(forgotPasswordResp?.data);
    } catch (error) {
      return this.errorResponse([error]);
    }
  };

  getMetaData = async (): Promise<Types.ApiResponse<Types.MetaData>> => {
    try {
      const res = await this.dispatch(
        'getMetaData',
        ['graphql', 'rest'],
        {
          query:
            'query meta { meta { version client_id is_google_login_enabled is_facebook_login_enabled is_github_login_enabled is_linkedin_login_enabled is_apple_login_enabled is_discord_login_enabled is_twitter_login_enabled is_microsoft_login_enabled is_twitch_login_enabled is_roblox_login_enabled is_email_verification_enabled is_basic_authentication_enabled is_magic_link_login_enabled is_sign_up_enabled is_strong_password_enabled is_multi_factor_auth_enabled is_mobile_basic_authentication_enabled is_phone_verification_enabled } }',
          operationName: 'meta',
          op: 'meta',
        },
        { method: 'GET', path: '/v1/meta' },
      );

      return res?.errors?.length
        ? this.errorResponse(res.errors)
        : this.okResponse(res.data);
    } catch (error) {
      return this.errorResponse([error]);
    }
  };

  getProfile = async (
    headers?: Types.Headers,
  ): Promise<Types.ApiResponse<Types.User>> => {
    try {
      const profileRes = await this.dispatch(
        'getProfile',
        ['graphql', 'rest'],
        {
          query: `query profile {	profile { ${userFragment} } }`,
          operationName: 'profile',
          op: 'profile',
        },
        { method: 'GET', path: '/v1/profile' },
        undefined,
        headers,
      );

      return profileRes?.errors?.length
        ? this.errorResponse(profileRes.errors)
        : this.okResponse(profileRes.data);
    } catch (error) {
      return this.errorResponse([error]);
    }
  };

  // checkPermissions evaluates one or more permission checks ("does the
  // subject have `relation` on `object`?") in a single round trip using the
  // embedded OpenFGA engine. Results come back in the same order as the
  // supplied `checks`, each echoing its relation/object pair.
  //
  // The subject defaults to the authenticated caller and is pinned server-side
  // from the request (session cookie by default; pass the authorization header
  // in node.js). The optional `params.user` ("type:id", or a bare id treated
  // as "user:<id>") is honored only for super-admin callers or when it equals
  // the caller's own token subject; anything else is rejected by the server.
  checkPermissions = async (
    params: Types.CheckPermissionsInput,
    headers?: Types.Headers,
  ): Promise<Types.ApiResponse<Types.CheckPermissionsResponse>> => {
    try {
      const res = await this.dispatch(
        'checkPermissions',
        ['graphql', 'rest'],
        {
          query:
            'query checkPermissions($params: CheckPermissionsInput!){ check_permissions(params: $params) { results { relation object allowed } } }',
          operationName: 'checkPermissions',
          op: 'check_permissions',
        },
        { method: 'POST', path: '/v1/check_permissions', body: params },
        { params },
        headers,
      );

      return res?.errors?.length
        ? this.errorResponse(res.errors)
        : this.okResponse(res.data);
    } catch (error) {
      return this.errorResponse([error]);
    }
  };

  // listPermissions returns the fully-qualified ids of objects of
  // `object_type` the subject holds `relation` on (handy for filtering a list
  // to what the user can see). Subject resolution follows the same rules as
  // checkPermissions: it defaults to the authenticated caller, and the
  // optional `params.user` override is honored only for super-admin callers
  // or when it equals the caller's own token subject.
  listPermissions = async (
    params: Types.ListPermissionsInput,
    headers?: Types.Headers,
  ): Promise<Types.ApiResponse<Types.ListPermissionsResponse>> => {
    try {
      const res = await this.dispatch(
        'listPermissions',
        ['graphql', 'rest'],
        {
          query:
            'query listPermissions($params: ListPermissionsInput!){ list_permissions(params: $params) { objects } }',
          operationName: 'listPermissions',
          op: 'list_permissions',
        },
        { method: 'POST', path: '/v1/list_permissions', body: params },
        { params },
        headers,
      );

      return res?.errors?.length
        ? this.errorResponse(res.errors)
        : this.okResponse(res.data);
    } catch (error) {
      return this.errorResponse([error]);
    }
  };

  // this is used to verify / get session using cookie by default. If using node.js pass authorization header
  getSession = async (
    headers?: Types.Headers,
    params?: Types.SessionQueryRequest,
  ): Promise<Types.ApiResponse<Types.AuthToken>> => {
    try {
      const res = await this.dispatch(
        'getSession',
        ['graphql', 'rest'],
        {
          query: `query session($params: SessionQueryRequest){session(params: $params) { ${authTokenFragment} } }`,
          operationName: 'session',
          op: 'session',
        },
        {
          method: 'POST',
          path: '/v1/session',
          body: params || {},
        },
        { params },
        headers,
      );
      return res?.errors?.length
        ? this.errorResponse(res.errors)
        : this.okResponse(res.data);
    } catch (err) {
      return this.errorResponse(err);
    }
  };

  getToken = async (
    data: Types.GetTokenRequest,
  ): Promise<Types.ApiResponse<Types.GetTokenResponse>> => {
    if (!data.grant_type) data.grant_type = 'authorization_code';

    if (data.grant_type === 'refresh_token' && !data.refresh_token?.trim())
      return this.errorResponse([new Error('Invalid refresh_token')]);

    if (data.grant_type === 'authorization_code' && !this.codeVerifier)
      return this.errorResponse([new Error('Invalid code verifier')]);

    const requestData = {
      client_id: this.config.clientID,
      code: data.code || '',
      code_verifier: this.codeVerifier || '',
      grant_type: data.grant_type || '',
      refresh_token: data.refresh_token || '',
    };

    try {
      const fetcher = getFetcher();
      const res = await fetcher(`${this.config.authorizerURL}/oauth/token`, {
        method: 'POST',
        body: JSON.stringify(requestData),
        headers: {
          ...this.config.extraHeaders,
        },
        credentials: 'include',
      });

      const text = await res.text();
      let json: {
        error?: string;
        error_description?: string;
      } & Record<string, unknown> = {};
      if (text) {
        try {
          json = JSON.parse(text);
        } catch {
          return this.errorResponse([
            new Error(
              res.ok
                ? 'Invalid JSON from token endpoint'
                : `HTTP ${res.status}`,
            ),
          ]);
        }
      }
      if (!res.ok) {
        return this.errorResponse([
          new Error(
            String(
              json.error_description || json.error || `HTTP ${res.status}`,
            ),
          ),
        ]);
      }

      return this.okResponse(json);
    } catch (err) {
      return this.errorResponse(err);
    }
  };

  login = async (
    data: Types.LoginRequest,
  ): Promise<Types.ApiResponse<Types.AuthToken>> => {
    try {
      const res = await this.dispatch(
        'login',
        ['graphql', 'rest'],
        {
          query: `mutation login($data: LoginRequest!) { login(params: $data) { ${authTokenFragment}}}`,
          operationName: 'login',
          op: 'login',
        },
        { method: 'POST', path: '/v1/login', body: data },
        { data },
      );

      return res?.errors?.length
        ? this.errorResponse(res.errors)
        : this.okResponse(res.data);
    } catch (err) {
      return this.errorResponse(err);
    }
  };

  logout = async (
    headers?: Types.Headers,
  ): Promise<Types.ApiResponse<Types.GenericResponse>> => {
    try {
      const res = await this.dispatch(
        'logout',
        ['graphql', 'rest'],
        {
          query: 'mutation logout { logout { message } }',
          operationName: 'logout',
          op: 'logout',
        },
        { method: 'POST', path: '/v1/logout' },
        undefined,
        headers,
      );
      return res?.errors?.length
        ? this.errorResponse(res.errors)
        : this.okResponse(res.data);
    } catch (err) {
      return this.errorResponse([err]);
    }
  };

  magicLinkLogin = async (
    data: Types.MagicLinkLoginRequest,
  ): Promise<Types.ApiResponse<Types.GenericResponse>> => {
    try {
      if (!data.state) data.state = encode(createRandomString());

      if (!data.redirect_uri) data.redirect_uri = this.config.redirectURL;

      const res = await this.dispatch(
        'magicLinkLogin',
        ['graphql', 'rest'],
        {
          query: 'mutation magic_link_login($data: MagicLinkLoginRequest!) { magic_link_login(params: $data) { message }}',
          operationName: 'magic_link_login',
          op: 'magic_link_login',
        },
        { method: 'POST', path: '/v1/magic_link_login', body: data },
        { data },
      );

      return res?.errors?.length
        ? this.errorResponse(res.errors)
        : this.okResponse(res.data);
    } catch (err) {
      return this.errorResponse([err]);
    }
  };

  oauthLogin = async (
    oauthProvider: string,
    roles?: string[],
    redirect_uri?: string,
    state?: string,
  ): Promise<void> => {
    let urlState = state;
    if (!urlState) {
      urlState = encode(createRandomString());
    }

    const oauthProviderIds = Object.values(Types.OAuthProviders) as string[];
    if (!oauthProviderIds.includes(oauthProvider)) {
      throw new Error(
        `only following oauth providers are supported: ${oauthProviderIds.join(', ')}`,
      );
    }
    if (!hasWindow())
      throw new Error('oauthLogin is only supported for browsers');

    if (roles && roles.length) urlState += `&roles=${roles.join(',')}`;

    window.location.replace(
      `${this.config.authorizerURL}/oauth_login/${oauthProvider}?redirect_uri=${encodeURIComponent(
        redirect_uri || this.config.redirectURL || '',
      )}&state=${encodeURIComponent(urlState)}`,
    );
  };

  resendOtp = async (
    data: Types.ResendOtpRequest,
  ): Promise<Types.ApiResponse<Types.GenericResponse>> => {
    try {
      const res = await this.dispatch(
        'resendOtp',
        ['graphql', 'rest'],
        {
          query: 'mutation resend_otp($data: ResendOTPRequest!) { resend_otp(params: $data) { message }}',
          operationName: 'resend_otp',
          op: 'resend_otp',
        },
        { method: 'POST', path: '/v1/resend_otp', body: data },
        { data },
      );

      return res?.errors?.length
        ? this.errorResponse(res.errors)
        : this.okResponse(res.data);
    } catch (err) {
      return this.errorResponse([err]);
    }
  };

  resetPassword = async (
    data: Types.ResetPasswordRequest,
  ): Promise<Types.ApiResponse<Types.GenericResponse>> => {
    try {
      const resetPasswordRes = await this.dispatch(
        'resetPassword',
        ['graphql', 'rest'],
        {
          query:
            'mutation reset_password($data: ResetPasswordRequest!) {	reset_password(params: $data) { message } }',
          operationName: 'reset_password',
          op: 'reset_password',
        },
        { method: 'POST', path: '/v1/reset_password', body: data },
        { data },
      );
      return resetPasswordRes?.errors?.length
        ? this.errorResponse(resetPasswordRes.errors)
        : this.okResponse(resetPasswordRes.data);
    } catch (error) {
      return this.errorResponse([error]);
    }
  };

  revokeToken = async (data: { refresh_token: string }) => {
    if (!data.refresh_token?.trim())
      return this.errorResponse([new Error('Invalid refresh_token')]);

    try {
      const fetcher = getFetcher();
      const res = await fetcher(`${this.config.authorizerURL}/oauth/revoke`, {
        method: 'POST',
        headers: {
          ...this.config.extraHeaders,
        },
        body: JSON.stringify({
          refresh_token: data.refresh_token,
          client_id: this.config.clientID,
        }),
      });

      const text = await res.text();
      let responseData: Record<string, unknown> = {};
      if (text) {
        try {
          responseData = JSON.parse(text) as Record<string, unknown>;
        } catch {
          return this.errorResponse([
            new Error(
              res.ok
                ? 'Invalid JSON from revoke endpoint'
                : `HTTP ${res.status}`,
            ),
          ]);
        }
      }

      if (!res.ok) {
        const errBody = responseData as {
          error?: string;
          error_description?: string;
        };
        return this.errorResponse([
          new Error(
            String(
              errBody.error_description ||
                errBody.error ||
                `HTTP ${res.status}`,
            ),
          ),
        ]);
      }

      return this.okResponse(responseData);
    } catch (err) {
      return this.errorResponse(err);
    }
  };

  signup = async (
    data: Types.SignUpRequest,
  ): Promise<Types.ApiResponse<Types.AuthToken>> => {
    try {
      const res = await this.dispatch(
        'signup',
        ['graphql', 'rest'],
        {
          query: `mutation signup($data: SignUpRequest!) { signup(params: $data) { ${authTokenFragment}}}`,
          operationName: 'signup',
          op: 'signup',
        },
        { method: 'POST', path: '/v1/signup', body: data },
        { data },
      );

      return res?.errors?.length
        ? this.errorResponse(res.errors)
        : this.okResponse(res.data);
    } catch (err) {
      return this.errorResponse([err]);
    }
  };

  updateProfile = async (
    data: Types.UpdateProfileRequest,
    headers?: Types.Headers,
  ): Promise<Types.ApiResponse<Types.GenericResponse>> => {
    try {
      const updateProfileRes = await this.dispatch(
        'updateProfile',
        ['graphql', 'rest'],
        {
          query:
            'mutation update_profile($data: UpdateProfileRequest!) {	update_profile(params: $data) { message } }',
          operationName: 'update_profile',
          op: 'update_profile',
        },
        { method: 'POST', path: '/v1/update_profile', body: data },
        { data },
        headers,
      );

      return updateProfileRes?.errors?.length
        ? this.errorResponse(updateProfileRes.errors)
        : this.okResponse(updateProfileRes.data);
    } catch (error) {
      return this.errorResponse([error]);
    }
  };

  deactivateAccount = async (
    headers?: Types.Headers,
  ): Promise<Types.ApiResponse<Types.GenericResponse>> => {
    try {
      const res = await this.dispatch(
        'deactivateAccount',
        ['graphql', 'rest'],
        {
          query:
            'mutation deactivate_account { deactivate_account { message } }',
          operationName: 'deactivate_account',
          op: 'deactivate_account',
        },
        { method: 'POST', path: '/v1/deactivate_account' },
        undefined,
        headers,
      );
      return res?.errors?.length
        ? this.errorResponse(res.errors)
        : this.okResponse(res.data);
    } catch (error) {
      return this.errorResponse([error]);
    }
  };

  validateJWTToken = async (
    params?: Types.ValidateJWTTokenRequest,
  ): Promise<Types.ApiResponse<Types.ValidateJWTTokenResponse>> => {
    try {
      const res = await this.dispatch(
        'validateJWTToken',
        ['graphql', 'rest'],
        {
          query:
            'query validate_jwt_token($params: ValidateJWTTokenRequest!){validate_jwt_token(params: $params) { is_valid claims } }',
          operationName: 'validate_jwt_token',
          op: 'validate_jwt_token',
        },
        { method: 'POST', path: '/v1/validate_jwt_token', body: params },
        { params },
      );

      return res?.errors?.length
        ? this.errorResponse(res.errors)
        : this.okResponse(res.data);
    } catch (error) {
      return this.errorResponse([error]);
    }
  };

  validateSession = async (
    params?: Types.ValidateSessionRequest,
  ): Promise<Types.ApiResponse<Types.ValidateSessionResponse>> => {
    try {
      const res = await this.dispatch(
        'validateSession',
        ['graphql', 'rest'],
        {
          query: `query validate_session($params: ValidateSessionRequest){validate_session(params: $params) { is_valid user { ${userFragment} } } }`,
          operationName: 'validate_session',
          op: 'validate_session',
        },
        { method: 'POST', path: '/v1/validate_session', body: params },
        { params },
      );

      return res?.errors?.length
        ? this.errorResponse(res.errors)
        : this.okResponse(res.data);
    } catch (error) {
      return this.errorResponse([error]);
    }
  };

  verifyEmail = async (
    data: Types.VerifyEmailRequest,
  ): Promise<Types.ApiResponse<Types.AuthToken>> => {
    try {
      const res = await this.dispatch(
        'verifyEmail',
        ['graphql', 'rest'],
        {
          query: `mutation verify_email($data: VerifyEmailRequest!) { verify_email(params: $data) { ${authTokenFragment}}}`,
          operationName: 'verify_email',
          op: 'verify_email',
        },
        { method: 'POST', path: '/v1/verify_email', body: data },
        { data },
      );

      return res?.errors?.length
        ? this.errorResponse(res.errors)
        : this.okResponse(res.data);
    } catch (err) {
      return this.errorResponse([err]);
    }
  };

  resendVerifyEmail = async (
    data: Types.ResendVerifyEmailRequest,
  ): Promise<Types.ApiResponse<Types.GenericResponse>> => {
    try {
      const res = await this.dispatch(
        'resendVerifyEmail',
        ['graphql', 'rest'],
        {
          query: 'mutation resend_verify_email($data: ResendVerifyEmailRequest!) { resend_verify_email(params: $data) { message }}',
          operationName: 'resend_verify_email',
          op: 'resend_verify_email',
        },
        { method: 'POST', path: '/v1/resend_verify_email', body: data },
        { data },
      );

      return res?.errors?.length
        ? this.errorResponse(res.errors)
        : this.okResponse(res.data);
    } catch (err) {
      return this.errorResponse([err]);
    }
  };

  verifyOtp = async (
    data: Types.VerifyOtpRequest,
  ): Promise<Types.ApiResponse<Types.AuthToken>> => {
    try {
      const res = await this.dispatch(
        'verifyOtp',
        ['graphql', 'rest'],
        {
          query: `mutation verify_otp($data: VerifyOTPRequest!) { verify_otp(params: $data) { ${authTokenFragment}}}`,
          operationName: 'verify_otp',
          op: 'verify_otp',
        },
        { method: 'POST', path: '/v1/verify_otp', body: data },
        { data },
      );

      return res?.errors?.length
        ? this.errorResponse(res.errors)
        : this.okResponse(res.data);
    } catch (err) {
      return this.errorResponse([err]);
    }
  };

  // helper to execute graphql queries
  // takes in any query or mutation string as value
  graphqlQuery = async (
    data: Types.GraphqlQueryRequest,
  ): Promise<Types.GrapQlResponseType> => {
    const fetcher = getFetcher();
    const body: Record<string, unknown> = {
      query: data.query,
      variables: data.variables || {},
    };
    if (data.operationName) {
      body.operationName = data.operationName;
    }
    const res = await fetcher(`${this.config.authorizerURL}/graphql`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        ...this.config.extraHeaders,
        ...(data.headers || {}),
      },
      credentials: 'include',
    });

    const text = await res.text();
    let json: { data?: unknown; errors?: unknown[] } = {};
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        return {
          data: undefined,
          errors: [
            new Error(
              res.ok
                ? 'Invalid JSON from GraphQL endpoint'
                : `HTTP ${res.status}`,
            ),
          ],
        };
      }
    } else if (!res.ok) {
      return {
        data: undefined,
        errors: [new Error(`HTTP ${res.status}`)],
      };
    }

    if (json?.errors?.length) {
      return { data: undefined, errors: toErrorList(json.errors) };
    }

    if (!res.ok) {
      return {
        data: undefined,
        errors: [new Error(`HTTP ${res.status}`)],
      };
    }

    return { data: json.data, errors: [] };
  };

  // dispatch runs a public method over the configured protocol and returns the
  // same flat payload regardless of protocol. As of server 2.3.0-rc.9 (PR #635)
  // every public RPC works over both graphql and rest and the response envelope
  // is flat and byte-identical between them (snake_case): graphql reads
  // `data[gql.op]` (e.g. `data.signup` = AuthResponse), and rest returns the
  // same bare message as the body — no wrapper unwrapping. `rest.unwrap` remains
  // for the rare endpoint that still wraps. Each method passes the protocols it
  // supports; calling over an unsupported one raises a clear error early.
  dispatch = async (
    name: string,
    protocols: Types.Protocol[],
    gql: { query: string; operationName: string; op: string },
    rest: {
      method: 'GET' | 'POST';
      path: string;
      body?: Record<string, any>;
      unwrap?: string;
    },
    variables?: Record<string, any>,
    headers?: Types.Headers,
  ): Promise<Types.GrapQlResponseType> => {
    const protocol = this.config.protocol as Types.Protocol;
    if (!protocols.includes(protocol)) {
      return {
        data: undefined,
        errors: [
          new Error(
            `${name} is not available over ${protocol}; supported: ${protocols.join(', ')}`,
          ),
        ],
      };
    }
    if (protocol === 'rest') {
      const res = await this.restQuery(
        rest.method,
        rest.path,
        rest.body,
        headers,
      );
      if (res.errors.length) return res;
      const data = rest.unwrap ? res.data?.[rest.unwrap] : res.data;
      return { data, errors: [] };
    }
    const res = await this.graphqlQuery({
      query: gql.query,
      variables,
      headers,
      operationName: gql.operationName,
    });
    if (res.errors.length) return res;
    return { data: res.data?.[gql.op], errors: [] };
  };

  // helper to execute a public REST call (POST/GET /v1/<snake>). Reuses the
  // same fetch / credentials / Origin handling as graphqlQuery. Returns the
  // parsed JSON body (the proto-gateway response shape) under `data`.
  restQuery = async (
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
    headers?: Types.Headers,
  ): Promise<Types.GrapQlResponseType> => {
    const fetcher = getFetcher();
    const res = await fetcher(`${this.config.authorizerURL}${path}`, {
      method,
      ...(method === 'POST' ? { body: JSON.stringify(body || {}) } : {}),
      headers: {
        ...this.config.extraHeaders,
        ...(headers || {}),
      },
      credentials: 'include',
    });

    const text = await res.text();
    let json: { error?: string; message?: string } & Record<string, unknown> =
      {};
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        return {
          data: undefined,
          errors: [
            new Error(
              res.ok ? 'Invalid JSON from REST endpoint' : `HTTP ${res.status}`,
            ),
          ],
        };
      }
    } else if (!res.ok) {
      return { data: undefined, errors: [new Error(`HTTP ${res.status}`)] };
    }

    if (!res.ok) {
      // gRPC-gateway errors come back as { code, message, details }.
      return {
        data: undefined,
        errors: [
          new Error(String(json.message || json.error || `HTTP ${res.status}`)),
        ],
      };
    }

    // proto-gateway serializes int64 fields as strings; coerce to numbers so the
    // rest path returns the same number-typed shape as the graphql path.
    return { data: coerceInt64Fields(json), errors: [] };
  };

  errorResponse = (errors: unknown): Types.ApiResponse<any> => {
    return {
      data: undefined,
      errors: toErrorList(errors),
    };
  };

  okResponse = (data: any): Types.ApiResponse<any> => {
    return {
      data,
      errors: [],
    };
  };
}
