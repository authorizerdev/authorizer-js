// Note: write gql query in single line to reduce bundle size
import crossFetch from 'cross-fetch'
import { DEFAULT_AUTHORIZE_TIMEOUT_IN_SECONDS } from './constants'
import * as Types from './types'
import {
  bufferToBase64UrlEncoded,
  createQueryParams,
  createRandomString,
  encode,
  executeIframe,
  hasWindow,
  sha256,
  trimURL,
} from './utils'
import type {
  ApiResponse,
  AuthToken,
  AuthorizeResponse,
  ConfigType,
  GenericResponse,
  GetTokenResponse,
  GrapQlResponseType,
  MetaData,
  ResendVerifyEmailInput, User, ValidateJWTTokenResponse, ValidateSessionResponse,
} from './types'

// re-usable gql response fragment
const userFragment
  = 'id email email_verified given_name family_name middle_name nickname preferred_username picture signup_methods gender birthdate phone_number phone_number_verified roles created_at updated_at is_multi_factor_auth_enabled app_data'
const authTokenFragment = `message access_token expires_in refresh_token id_token should_show_email_otp_screen should_show_mobile_otp_screen should_show_totp_screen authenticator_scanner_image authenticator_secret authenticator_recovery_codes user { ${userFragment} }`

// set fetch based on window object. Cross fetch have issues with umd build
const getFetcher = () => (hasWindow() ? window.fetch : crossFetch)

export * from './types'

export class Authorizer {
  // class variable
  config: ConfigType
  codeVerifier: string

  // constructor
  constructor(config: ConfigType) {
    if (!config)
      throw new Error('Configuration is required')

    this.config = config
    if (!config.authorizerURL && !config.authorizerURL.trim())
      throw new Error('Invalid authorizerURL')

    if (config.authorizerURL)
      this.config.authorizerURL = trimURL(config.authorizerURL)

    if (!config.redirectURL && !config.redirectURL.trim())
      throw new Error('Invalid redirectURL')
    else
      this.config.redirectURL = trimURL(config.redirectURL)

    this.config.extraHeaders = {
      ...(config.extraHeaders || {}),
      'x-authorizer-url': this.config.authorizerURL,
      'Content-Type': 'application/json',
    }
    this.config.clientID = config.clientID.trim()
  }

  authorize = async (data: Types.AuthorizeInput): Promise<ApiResponse<GetTokenResponse> | ApiResponse<AuthorizeResponse>> => {
    if (!hasWindow())
      return this.errorResponse([new Error('this feature is only supported in browser')])

    const scopes = ['openid', 'profile', 'email']
    if (data.use_refresh_token)
      scopes.push('offline_access')

    const requestData: Record<string, string> = {
      redirect_uri: this.config.redirectURL,
      response_mode: data.response_mode || 'web_message',
      state: encode(createRandomString()),
      nonce: encode(createRandomString()),
      response_type: data.response_type,
      scope: scopes.join(' '),
      client_id: this.config.clientID,
    }

    if (data.response_type === Types.ResponseTypes.Code) {
      this.codeVerifier = createRandomString()
      const sha = await sha256(this.codeVerifier)
      const codeChallenge = bufferToBase64UrlEncoded(sha)
      requestData.code_challenge = codeChallenge
    }

    const authorizeURL = `${
      this.config.authorizerURL
    }/authorize?${createQueryParams(requestData)}`

    if (requestData.response_mode !== 'web_message') {
      window.location.replace(authorizeURL)
      return this.okResponse(undefined)
    }

    try {
      const iframeRes = await executeIframe(
        authorizeURL,
        this.config.authorizerURL,
        DEFAULT_AUTHORIZE_TIMEOUT_IN_SECONDS,
      )

      if (data.response_type === Types.ResponseTypes.Code) {
        // get token and return it
        const tokenResp: ApiResponse<GetTokenResponse> = await this.getToken({ code: iframeRes.code })
        return tokenResp.errors.length ? this.errorResponse(tokenResp.errors) : this.okResponse(tokenResp.data)
      }

      // this includes access_token, id_token & refresh_token(optionally)
      return this.okResponse(iframeRes)
    }
    catch (err) {
      if (err.error) {
        window.location.replace(
          `${this.config.authorizerURL}/app?state=${encode(
            JSON.stringify(this.config),
          )}&redirect_uri=${this.config.redirectURL}`,
        )
      }

      return this.errorResponse(err)
    }
  }

  browserLogin = async (): Promise<ApiResponse<AuthToken>> => {
    try {
      const tokenResp: ApiResponse<AuthToken> = await this.getSession()
      return tokenResp.errors.length ? this.errorResponse(tokenResp.errors) : this.okResponse(tokenResp.data)
    }
    catch (err) {
      if (!hasWindow()) {
        return {
          data: undefined,
          errors: [new Error('browserLogin is only supported for browsers')],
        }
      }

      window.location.replace(
        `${this.config.authorizerURL}/app?state=${encode(
          JSON.stringify(this.config),
        )}&redirect_uri=${this.config.redirectURL}`,
      )
      return this.errorResponse(err)
    }
  }

  forgotPassword = async (
    data: Types.ForgotPasswordInput,
  ): Promise<ApiResponse<GenericResponse>> => {
    if (!data.state)
      data.state = encode(createRandomString())

    if (!data.redirect_uri)
      data.redirect_uri = this.config.redirectURL

    try {
      const forgotPasswordResp = await this.graphqlQuery({
        query:
          'mutation forgotPassword($data: ForgotPasswordInput!) {	forgot_password(params: $data) { message } }',
        variables: {
          data,
        },
      })
      return forgotPasswordResp?.errors?.length ? this.errorResponse(forgotPasswordResp.errors) : this.okResponse(forgotPasswordResp?.data.forgot_password)
    }
    catch (error) {
      return this.errorResponse([error])
    }
  }

  getMetaData = async (): Promise<ApiResponse<MetaData>> => {
    try {
      const res = await this.graphqlQuery({
        query:
          'query { meta { version is_google_login_enabled is_facebook_login_enabled is_github_login_enabled is_linkedin_login_enabled is_apple_login_enabled is_twitter_login_enabled is_microsoft_login_enabled is_twitch_login_enabled is_email_verification_enabled is_basic_authentication_enabled is_magic_link_login_enabled is_sign_up_enabled is_strong_password_enabled } }',
      })

      return res?.errors?.length ? this.errorResponse(res.errors) : this.okResponse(res.data.meta)
    }
    catch (error) {
      return this.errorResponse([error])
    }
  }

  getProfile = async (headers?: Types.Headers): Promise<ApiResponse<User>> => {
    try {
      const profileRes = await this.graphqlQuery({
        query: `query {	profile { ${userFragment} } }`,
        headers,
      })

      return profileRes?.errors?.length ? this.errorResponse(profileRes.errors) : this.okResponse(profileRes.data.profile)
    }
    catch (error) {
      return this.errorResponse([error])
    }
  }

  // this is used to verify / get session using cookie by default. If using node.js pass authorization header
  getSession = async (
    headers?: Types.Headers,
    params?: Types.SessionQueryInput,
  ): Promise<ApiResponse<AuthToken>> => {
    try {
      const res = await this.graphqlQuery({
        query: `query getSession($params: SessionQueryInput){session(params: $params) { ${authTokenFragment} } }`,
        headers,
        variables: {
          params,
        },
      })
      return res?.errors?.length ? this.errorResponse(res.errors) : this.okResponse(res.data?.session)
    }
    catch (err) {
      return this.errorResponse(err)
    }
  }

  getToken = async (
    data: Types.GetTokenInput,
  ): Promise<ApiResponse<GetTokenResponse>> => {
    if (!data.grant_type)
      data.grant_type = 'authorization_code'

    if (data.grant_type === 'refresh_token' && !data.refresh_token)
      return this.errorResponse([new Error('Invalid refresh_token')])

    if (data.grant_type === 'authorization_code' && !this.codeVerifier)
      return this.errorResponse([new Error('Invalid code verifier')])

    const requestData = {
      client_id: this.config.clientID,
      code: data.code || '',
      code_verifier: this.codeVerifier || '',
      grant_type: data.grant_type || '',
      refresh_token: data.refresh_token || '',
    }

    try {
      const fetcher = getFetcher()
      const res = await fetcher(`${this.config.authorizerURL}/oauth/token`, {
        method: 'POST',
        body: JSON.stringify(requestData),
        headers: {
          ...this.config.extraHeaders,
        },
        credentials: 'include',
      })

      const json = await res.json()
      if (res.status >= 400)
        return this.errorResponse([new Error(json)])

      return this.okResponse(json)
    }
    catch (err) {
      return this.errorResponse(err)
    }
  }

  login = async (data: Types.LoginInput): Promise<ApiResponse<AuthToken>> => {
    try {
      const res = await this.graphqlQuery({
        query: `
					mutation login($data: LoginInput!) { login(params: $data) { ${authTokenFragment}}}
				`,
        variables: { data },
      })

      return res?.errors?.length ? this.errorResponse(res.errors) : this.okResponse(res.data?.login)
    }
    catch (err) {
      return this.errorResponse([new Error(err)])
    }
  }

  logout = async (headers?: Types.Headers): Promise<ApiResponse<GenericResponse>> => {
    try {
      const res = await this.graphqlQuery({
        query: ' mutation { logout { message } } ',
        headers,
      })
      return res?.errors?.length ? this.errorResponse(res.errors) : this.okResponse(res.data?.response)
    }
    catch (err) {
      console.error(err)
      return this.errorResponse([err])
    }
  }

  magicLinkLogin = async (
    data: Types.MagicLinkLoginInput,
  ): Promise<ApiResponse<GenericResponse>> => {
    try {
      if (!data.state)
        data.state = encode(createRandomString())

      if (!data.redirect_uri)
        data.redirect_uri = this.config.redirectURL

      const res = await this.graphqlQuery({
        query: `
					mutation magicLinkLogin($data: MagicLinkLoginInput!) { magic_link_login(params: $data) { message }}
				`,
        variables: { data },
      })

      return res?.errors?.length ? this.errorResponse(res.errors) : this.okResponse(res.data?.magic_link_login)
    }
    catch (err) {
      return this.errorResponse([err])
    }
  }

  oauthLogin = async (
    oauthProvider: string,
    roles?: string[],
    redirect_uri?: string,
    state?: string,
  ): Promise<void> => {
    let urlState = state
    if (!urlState)
      urlState = encode(createRandomString())

    // @ts-expect-error
    if (!Object.values(Types.OAuthProviders).includes(oauthProvider)) {
      throw new Error(
        `only following oauth providers are supported: ${Object.values(
          oauthProvider,
        ).toString()}`,
      )
    }
    if (!hasWindow())
      throw new Error('oauthLogin is only supported for browsers')

    if (roles && roles.length)
      urlState += `&roles=${roles.join(',')}`

    window.location.replace(
      `${this.config.authorizerURL}/oauth_login/${oauthProvider}?redirect_uri=${
        redirect_uri || this.config.redirectURL
      }&state=${urlState}`,
    )
  }

  resendOtp = async (
    data: Types.ResendOtpInput,
  ): Promise<ApiResponse<GenericResponse>> => {
    try {
      const res = await this.graphqlQuery({
        query: `
					mutation resendOtp($data: ResendOTPRequest!) { resend_otp(params: $data) { message }}
				`,
        variables: { data },
      })

      return res?.errors?.length ? this.errorResponse(res.errors) : this.okResponse(res.data?.resend_otp)
    }
    catch (err) {
      return this.errorResponse([err])
    }
  }

  resetPassword = async (
    data: Types.ResetPasswordInput,
  ): Promise<ApiResponse<GenericResponse>> => {
    try {
      const resetPasswordRes = await this.graphqlQuery({
        query:
          'mutation resetPassword($data: ResetPasswordInput!) {	reset_password(params: $data) { message } }',
        variables: {
          data,
        },
      })
      return resetPasswordRes?.errors?.length ? this.errorResponse(resetPasswordRes.errors) : this.okResponse(resetPasswordRes.data?.reset_password)
    }
    catch (error) {
      return this.errorResponse([error])
    }
  }

  revokeToken = async (data: { refresh_token: string }) => {
    if (!data.refresh_token && !data.refresh_token.trim())
      return this.errorResponse([new Error('Invalid refresh_token')])

    const fetcher = getFetcher()
    const res = await fetcher(`${this.config.authorizerURL}/oauth/revoke`, {
      method: 'POST',
      headers: {
        ...this.config.extraHeaders,
      },
      body: JSON.stringify({
        refresh_token: data.refresh_token,
        client_id: this.config.clientID,
      }),
    })

    const responseData = await res.json()
    return this.okResponse(responseData)
  }

  signup = async (data: Types.SignupInput): Promise<ApiResponse<AuthToken>> => {
    try {
      const res = await this.graphqlQuery({
        query: `
					mutation signup($data: SignUpInput!) { signup(params: $data) { ${authTokenFragment}}}
				`,
        variables: { data },
      })

      return res?.errors?.length ? this.errorResponse(res.errors) : this.okResponse(res.data?.signup)
    }
    catch (err) {
      return this.errorResponse([err])
    }
  }

  updateProfile = async (
    data: Types.UpdateProfileInput,
    headers?: Types.Headers,
  ): Promise<ApiResponse<GenericResponse>> => {
    try {
      const updateProfileRes = await this.graphqlQuery({
        query:
          'mutation updateProfile($data: UpdateProfileInput!) {	update_profile(params: $data) { message } }',
        headers,
        variables: {
          data,
        },
      })

      return updateProfileRes?.errors?.length ? this.errorResponse(updateProfileRes.errors) : this.okResponse(updateProfileRes.data?.update_profile)
    }
    catch (error) {
      return this.errorResponse([error])
    }
  }

  deactivateAccount = async (
    headers?: Types.Headers,
  ): Promise<ApiResponse<GenericResponse>> => {
    try {
      const res = await this.graphqlQuery({
        query: 'mutation deactivateAccount { deactivate_account { message } }',
        headers,
      })
      return res?.errors?.length ? this.errorResponse(res.errors) : this.okResponse(res.data?.deactivate_account)
    }
    catch (error) {
      return this.errorResponse([error])
    }
  }

  validateJWTToken = async (
    params?: Types.ValidateJWTTokenInput,
  ): Promise<ApiResponse<ValidateJWTTokenResponse>> => {
    try {
      const res = await this.graphqlQuery({
        query:
          'query validateJWTToken($params: ValidateJWTTokenInput!){validate_jwt_token(params: $params) { is_valid claims } }',
        variables: {
          params,
        },
      })

      return res?.errors?.length ? this.errorResponse(res.errors) : this.okResponse(res.data?.validate_jwt_token)
    }
    catch (error) {
      return this.errorResponse([error])
    }
  }

  validateSession = async (
    params?: Types.ValidateSessionInput,
  ): Promise<ApiResponse<ValidateSessionResponse>> => {
    try {
      const res = await this.graphqlQuery({
        query: `query validateSession($params: ValidateSessionInput){validate_session(params: $params) { is_valid user { ${userFragment} } } }`,
        variables: {
          params,
        },
      })

      return res?.errors?.length ? this.errorResponse(res.errors) : this.okResponse(res.data?.validate_session)
    }
    catch (error) {
      return this.errorResponse([error])
    }
  }

  verifyEmail = async (
    data: Types.VerifyEmailInput,
  ): Promise<ApiResponse<AuthToken>> => {
    try {
      const res = await this.graphqlQuery({
        query: `
					mutation verifyEmail($data: VerifyEmailInput!) { verify_email(params: $data) { ${authTokenFragment}}}
				`,
        variables: { data },
      })

      return res?.errors?.length ? this.errorResponse(res.errors) : this.okResponse(res.data?.verify_email)
    }
    catch (err) {
      return this.errorResponse([err])
    }
  }

  resendVerifyEmail = async (
    data: ResendVerifyEmailInput,
  ): Promise<ApiResponse<GenericResponse>> => {
    try {
      const res = await this.graphqlQuery({
        query: `
					mutation resendVerifyEmail($data: ResendVerifyEmailInput!) { resend_verify_email(params: $data) { message }}
				`,
        variables: { data },
      })

      return res?.errors?.length ? this.errorResponse(res.errors) : this.okResponse(res.data?.verify_email)
    }
    catch (err) {
      return this.errorResponse([err])
    }
  }

  verifyOtp = async (
    data: Types.VerifyOtpInput,
  ): Promise<ApiResponse<AuthToken>> => {
    try {
      const res = await this.graphqlQuery({
        query: `
					mutation verifyOtp($data: VerifyOTPRequest!) { verify_otp(params: $data) { ${authTokenFragment}}}
				`,
        variables: { data },
      })

      return res?.errors?.length ? this.errorResponse(res.errors) : this.okResponse(res.data?.verify_otp)
    }
    catch (err) {
      return this.errorResponse([err])
    }
  }

  // helper to execute graphql queries
  // takes in any query or mutation string as input
  private graphqlQuery = async (data: Types.GraphqlQueryInput): Promise<GrapQlResponseType> => {
    const fetcher = getFetcher()
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
    })

    const json = await res.json()

    if (json?.errors?.length) {
      console.error(json.errors)
      return { data: undefined, errors: json.errors }
    }

    return { data: json.data, errors: [] }
  }

  private errorResponse = (errors: Error[]): ApiResponse<any> => {
    return {
      data: undefined,
      errors,
    }
  }

  private okResponse = (data: any): ApiResponse<any> => {
    return {
      data,
      errors: [],
    }
  }
}
