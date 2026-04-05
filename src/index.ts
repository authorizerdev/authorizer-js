// Note: write gql query in single line to reduce bundle size
import crossFetch from 'cross-fetch';
import { DEFAULT_AUTHORIZE_TIMEOUT_IN_SECONDS } from './constants';
import * as Types from './types';
import {
  bufferToBase64UrlEncoded,
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
      const forgotPasswordResp = await this.graphqlQuery({
        query:
          'mutation forgotPassword($data: ForgotPasswordRequest!) {	forgot_password(params: $data) { message should_show_mobile_otp_screen } }',
        variables: {
          data,
        },
      });
      return forgotPasswordResp?.errors?.length
        ? this.errorResponse(forgotPasswordResp.errors)
        : this.okResponse(forgotPasswordResp?.data?.forgot_password);
    } catch (error) {
      return this.errorResponse([error]);
    }
  };

  getMetaData = async (): Promise<Types.ApiResponse<Types.MetaData>> => {
    try {
      const res = await this.graphqlQuery({
        query:
          'query { meta { version client_id is_google_login_enabled is_facebook_login_enabled is_github_login_enabled is_linkedin_login_enabled is_apple_login_enabled is_twitter_login_enabled is_microsoft_login_enabled is_twitch_login_enabled is_roblox_login_enabled is_email_verification_enabled is_basic_authentication_enabled is_magic_link_login_enabled is_sign_up_enabled is_strong_password_enabled is_multi_factor_auth_enabled is_mobile_basic_authentication_enabled is_phone_verification_enabled } }',
      });

      return res?.errors?.length
        ? this.errorResponse(res.errors)
        : this.okResponse(res.data.meta);
    } catch (error) {
      return this.errorResponse([error]);
    }
  };

  getProfile = async (
    headers?: Types.Headers,
  ): Promise<Types.ApiResponse<Types.User>> => {
    try {
      const profileRes = await this.graphqlQuery({
        query: `query {	profile { ${userFragment} } }`,
        headers,
      });

      return profileRes?.errors?.length
        ? this.errorResponse(profileRes.errors)
        : this.okResponse(profileRes.data.profile);
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
      const res = await this.graphqlQuery({
        query: `query getSession($params: SessionQueryRequest){session(params: $params) { ${authTokenFragment} } }`,
        headers,
        variables: {
          params,
        },
      });
      return res?.errors?.length
        ? this.errorResponse(res.errors)
        : this.okResponse(res.data?.session);
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
      const res = await this.graphqlQuery({
        query: `
					mutation login($data: LoginRequest!) { login(params: $data) { ${authTokenFragment}}}
				`,
        variables: { data },
      });

      return res?.errors?.length
        ? this.errorResponse(res.errors)
        : this.okResponse(res.data?.login);
    } catch (err) {
      return this.errorResponse(err);
    }
  };

  logout = async (
    headers?: Types.Headers,
  ): Promise<Types.ApiResponse<Types.GenericResponse>> => {
    try {
      const res = await this.graphqlQuery({
        query: ' mutation { logout { message } } ',
        headers,
      });
      return res?.errors?.length
        ? this.errorResponse(res.errors)
        : this.okResponse(res.data?.logout);
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

      const res = await this.graphqlQuery({
        query: `
					mutation magicLinkLogin($data: MagicLinkLoginRequest!) { magic_link_login(params: $data) { message }}
				`,
        variables: { data },
      });

      return res?.errors?.length
        ? this.errorResponse(res.errors)
        : this.okResponse(res.data?.magic_link_login);
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
      const res = await this.graphqlQuery({
        query: `
					mutation resendOtp($data: ResendOTPRequest!) { resend_otp(params: $data) { message }}
				`,
        variables: { data },
      });

      return res?.errors?.length
        ? this.errorResponse(res.errors)
        : this.okResponse(res.data?.resend_otp);
    } catch (err) {
      return this.errorResponse([err]);
    }
  };

  resetPassword = async (
    data: Types.ResetPasswordRequest,
  ): Promise<Types.ApiResponse<Types.GenericResponse>> => {
    try {
      const resetPasswordRes = await this.graphqlQuery({
        query:
          'mutation resetPassword($data: ResetPasswordRequest!) {	reset_password(params: $data) { message } }',
        variables: {
          data,
        },
      });
      return resetPasswordRes?.errors?.length
        ? this.errorResponse(resetPasswordRes.errors)
        : this.okResponse(resetPasswordRes.data?.reset_password);
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
      const res = await this.graphqlQuery({
        query: `
					mutation signup($data: SignUpRequest!) { signup(params: $data) { ${authTokenFragment}}}
				`,
        variables: { data },
      });

      return res?.errors?.length
        ? this.errorResponse(res.errors)
        : this.okResponse(res.data?.signup);
    } catch (err) {
      return this.errorResponse([err]);
    }
  };

  updateProfile = async (
    data: Types.UpdateProfileRequest,
    headers?: Types.Headers,
  ): Promise<Types.ApiResponse<Types.GenericResponse>> => {
    try {
      const updateProfileRes = await this.graphqlQuery({
        query:
          'mutation updateProfile($data: UpdateProfileRequest!) {	update_profile(params: $data) { message } }',
        headers,
        variables: {
          data,
        },
      });

      return updateProfileRes?.errors?.length
        ? this.errorResponse(updateProfileRes.errors)
        : this.okResponse(updateProfileRes.data?.update_profile);
    } catch (error) {
      return this.errorResponse([error]);
    }
  };

  deactivateAccount = async (
    headers?: Types.Headers,
  ): Promise<Types.ApiResponse<Types.GenericResponse>> => {
    try {
      const res = await this.graphqlQuery({
        query: 'mutation deactivateAccount { deactivate_account { message } }',
        headers,
      });
      return res?.errors?.length
        ? this.errorResponse(res.errors)
        : this.okResponse(res.data?.deactivate_account);
    } catch (error) {
      return this.errorResponse([error]);
    }
  };

  validateJWTToken = async (
    params?: Types.ValidateJWTTokenRequest,
  ): Promise<Types.ApiResponse<Types.ValidateJWTTokenResponse>> => {
    try {
      const res = await this.graphqlQuery({
        query:
          'query validateJWTToken($params: ValidateJWTTokenRequest!){validate_jwt_token(params: $params) { is_valid claims } }',
        variables: {
          params,
        },
      });

      return res?.errors?.length
        ? this.errorResponse(res.errors)
        : this.okResponse(res.data?.validate_jwt_token);
    } catch (error) {
      return this.errorResponse([error]);
    }
  };

  validateSession = async (
    params?: Types.ValidateSessionRequest,
  ): Promise<Types.ApiResponse<Types.ValidateSessionResponse>> => {
    try {
      const res = await this.graphqlQuery({
        query: `query validateSession($params: ValidateSessionRequest){validate_session(params: $params) { is_valid user { ${userFragment} } } }`,
        variables: {
          params,
        },
      });

      return res?.errors?.length
        ? this.errorResponse(res.errors)
        : this.okResponse(res.data?.validate_session);
    } catch (error) {
      return this.errorResponse([error]);
    }
  };

  verifyEmail = async (
    data: Types.VerifyEmailRequest,
  ): Promise<Types.ApiResponse<Types.AuthToken>> => {
    try {
      const res = await this.graphqlQuery({
        query: `
					mutation verifyEmail($data: VerifyEmailRequest!) { verify_email(params: $data) { ${authTokenFragment}}}
				`,
        variables: { data },
      });

      return res?.errors?.length
        ? this.errorResponse(res.errors)
        : this.okResponse(res.data?.verify_email);
    } catch (err) {
      return this.errorResponse([err]);
    }
  };

  resendVerifyEmail = async (
    data: Types.ResendVerifyEmailRequest,
  ): Promise<Types.ApiResponse<Types.GenericResponse>> => {
    try {
      const res = await this.graphqlQuery({
        query: `
					mutation resendVerifyEmail($data: ResendVerifyEmailRequest!) { resend_verify_email(params: $data) { message }}
				`,
        variables: { data },
      });

      return res?.errors?.length
        ? this.errorResponse(res.errors)
        : this.okResponse(res.data?.resend_verify_email);
    } catch (err) {
      return this.errorResponse([err]);
    }
  };

  verifyOtp = async (
    data: Types.VerifyOtpRequest,
  ): Promise<Types.ApiResponse<Types.AuthToken>> => {
    try {
      const res = await this.graphqlQuery({
        query: `
					mutation verifyOtp($data: VerifyOTPRequest!) { verify_otp(params: $data) { ${authTokenFragment}}}
				`,
        variables: { data },
      });

      return res?.errors?.length
        ? this.errorResponse(res.errors)
        : this.okResponse(res.data?.verify_otp);
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
    const res = await fetcher(`${this.config.authorizerURL}/graphql`, {
      method: 'POST',
      body: JSON.stringify({
        query: data.query,
        variables: data.variables || {},
      }),
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
