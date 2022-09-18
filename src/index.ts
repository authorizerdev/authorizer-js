// Note: write gql query in single line to reduce bundle size
import crossFetch from 'cross-fetch';
import { DEFAULT_AUTHORIZE_TIMEOUT_IN_SECONDS } from './constants';
import * as Types from './types';
import {
	trimURL,
	hasWindow,
	encode,
	createRandomString,
	sha256,
	bufferToBase64UrlEncoded,
	createQueryParams,
	executeIframe,
} from './utils';

// re-usable gql response fragment
const userFragment = `id email email_verified given_name family_name middle_name nickname preferred_username picture signup_methods gender birthdate phone_number phone_number_verified roles created_at updated_at is_multi_factor_auth_enabled `;
const authTokenFragment = `message access_token expires_in refresh_token id_token should_show_otp_screen user { ${userFragment} }`;

// set fetch based on window object. Cross fetch have issues with umd build
const getFetcher = () => (hasWindow() ? window.fetch : crossFetch);

export * from './types';
export class Authorizer {
	// class variable
	config: Types.ConfigType;
	codeVerifier: string;

	// constructor
	constructor(config: Types.ConfigType) {
		if (!config) {
			throw new Error(`Configuration is required`);
		}
		this.config = config;
		if (!config.authorizerURL && !config.authorizerURL.trim()) {
			throw new Error(`Invalid authorizerURL`);
		}
		if (config.authorizerURL) {
			this.config.authorizerURL = trimURL(config.authorizerURL);
		}
		if (!config.redirectURL && !config.redirectURL.trim()) {
			throw new Error(`Invalid redirectURL`);
		} else {
			this.config.redirectURL = trimURL(config.redirectURL);
		}

		this.config.extraHeaders = {
			...(config.extraHeaders || {}),
			'x-authorizer-url': this.config.authorizerURL,
			'Content-Type': 'application/json',
		};
		this.config.clientID = config.clientID.trim();
	}

	authorize = async (data: Types.AuthorizeInput) => {
		if (!hasWindow()) {
			throw new Error(`this feature is only supported in browser`);
		}

		const scopes = ['openid', 'profile', 'email'];
		if (data.use_refresh_token) {
			scopes.push('offline_access');
		}

		const requestData: Record<string, string> = {
			redirect_uri: this.config.redirectURL,
			response_mode: data.response_mode || 'web_message',
			state: encode(createRandomString()),
			nonce: encode(createRandomString()),
			response_type: data.response_type,
			scope: scopes.join(' '),
			client_id: this.config.clientID,
		};

		if (data.response_type === Types.ResponseTypes.Code) {
			this.codeVerifier = createRandomString();
			const sha = await sha256(this.codeVerifier);
			const codeChallenge = bufferToBase64UrlEncoded(sha);
			requestData.code_challenge = codeChallenge;
		}

		const authorizeURL = `${
			this.config.authorizerURL
		}/authorize?${createQueryParams(requestData)}`;

		try {
			const iframeRes = await executeIframe(
				authorizeURL,
				this.config.authorizerURL,
				DEFAULT_AUTHORIZE_TIMEOUT_IN_SECONDS,
			);

			if (data.response_type === Types.ResponseTypes.Code) {
				// get token and return it
				const token = await this.getToken({ code: iframeRes.code });
				return token;
			}

			// this includes access_token, id_token & refresh_token(optionally)
			return iframeRes;
		} catch (err) {
			if (err.error) {
				window.location.replace(
					`${this.config.authorizerURL}/app?state=${encode(
						JSON.stringify(this.config),
					)}&redirect_uri=${this.config.redirectURL}`,
				);
			}

			throw err;
		}
	};

	browserLogin = async (): Promise<Types.AuthToken | void> => {
		try {
			const token = await this.getSession();
			return token;
		} catch (err) {
			if (!hasWindow()) {
				throw new Error(`browserLogin is only supported for browsers`);
			}
			window.location.replace(
				`${this.config.authorizerURL}/app?state=${encode(
					JSON.stringify(this.config),
				)}&redirect_uri=${this.config.redirectURL}`,
			);
		}
	};

	forgotPassword = async (
		data: Types.ForgotPasswordInput,
	): Promise<Types.Response | void> => {
		if (!data.state) {
			data.state = encode(createRandomString());
		}

		if (!data.redirect_uri) {
			data.redirect_uri = this.config.redirectURL;
		}

		try {
			const forgotPasswordRes = await this.graphqlQuery({
				query: `mutation forgotPassword($data: ForgotPasswordInput!) {	forgot_password(params: $data) { message } }`,
				variables: {
					data,
				},
			});

			return forgotPasswordRes.forgot_password;
		} catch (error) {
			throw error;
		}
	};

	getMetaData = async (): Promise<Types.MetaData | void> => {
		try {
			const res = await this.graphqlQuery({
				query: `query { meta { version is_google_login_enabled is_facebook_login_enabled is_github_login_enabled is_linkedin_login_enabled is_apple_login_enabled is_twitter_login_enabled is_email_verification_enabled is_basic_authentication_enabled is_magic_link_login_enabled is_sign_up_enabled is_strong_password_enabled } }`,
			});

			return res.meta;
		} catch (err) {
			throw err;
		}
	};

	getProfile = async (headers?: Types.Headers): Promise<Types.User | void> => {
		try {
			const profileRes = await this.graphqlQuery({
				query: `query {	profile { ${userFragment} } }`,
				headers,
			});

			return profileRes.profile;
		} catch (error) {
			throw error;
		}
	};

	// this is used to verify / get session using cookie by default. If using nodejs pass authorization header
	getSession = async (
		headers?: Types.Headers,
		params?: Types.SessionQueryInput,
	): Promise<Types.AuthToken> => {
		try {
			const res = await this.graphqlQuery({
				query: `query getSession($params: SessionQueryInput){session(params: $params) { ${authTokenFragment} } }`,
				headers,
				variables: {
					params,
				},
			});
			return res.session;
		} catch (err) {
			throw err;
		}
	};

	getToken = async (
		data: Types.GetTokenInput,
	): Promise<Types.GetTokenResponse> => {
		if (!data.grant_type) {
			data.grant_type = 'authorization_code';
		}

		if (data.grant_type === 'refresh_token' && !data.refresh_token) {
			throw new Error(`Invalid refresh_token`);
		}
		if (data.grant_type === 'authorization_code' && !this.codeVerifier) {
			throw new Error(`Invalid code verifier`);
		}

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

			const json = await res.json();
			if (res.status >= 400) {
				throw new Error(json);
			}
			return json;
		} catch (err) {
			throw err;
		}
	};

	// helper to execute graphql queries
	// takes in any query or mutation string as input
	graphqlQuery = async (data: Types.GraphqlQueryInput) => {
		const fetcher = getFetcher();
		const res = await fetcher(this.config.authorizerURL + '/graphql', {
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

		const json = await res.json();

		if (json.errors && json.errors.length) {
			console.error(json.errors);
			throw new Error(json.errors[0].message);
		}

		return json.data;
	};

	login = async (data: Types.LoginInput): Promise<Types.AuthToken | void> => {
		try {
			const res = await this.graphqlQuery({
				query: `
					mutation login($data: LoginInput!) { login(params: $data) { ${authTokenFragment}}}
				`,
				variables: { data },
			});

			return res.login;
		} catch (err) {
			throw err;
		}
	};

	logout = async (headers?: Types.Headers): Promise<Types.Response | void> => {
		try {
			const res = await this.graphqlQuery({
				query: ` mutation { logout { message } } `,
				headers,
			});
			return res.logout;
		} catch (err) {
			console.error(err);
		}
	};

	magicLinkLogin = async (
		data: Types.MagicLinkLoginInput,
	): Promise<Types.Response> => {
		try {
			if (!data.state) {
				data.state = encode(createRandomString());
			}

			if (!data.redirect_uri) {
				data.redirect_uri = this.config.redirectURL;
			}

			const res = await this.graphqlQuery({
				query: `
					mutation magicLinkLogin($data: MagicLinkLoginInput!) { magic_link_login(params: $data) { message }}
				`,
				variables: { data },
			});

			return res.magic_link_login;
		} catch (err) {
			throw err;
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
		// @ts-ignore
		if (!Object.values(Types.OAuthProviders).includes(oauthProvider)) {
			throw new Error(
				`only following oauth providers are supported: ${Object.values(
					oauthProvider,
				).toString()}`,
			);
		}
		if (!hasWindow()) {
			throw new Error(`oauthLogin is only supported for browsers`);
		}
		window.location.replace(
			`${this.config.authorizerURL}/oauth_login/${oauthProvider}?redirect_uri=${
				redirect_uri || this.config.redirectURL
			}&state=${urlState}${
				roles && roles.length ? `&roles=${roles.join(',')}` : ``
			}`,
		);
	};

	resendOtp = async (
		data: Types.ResendOtpInput,
	): Promise<Types.Response | void> => {
		try {
			const res = await this.graphqlQuery({
				query: `
					mutation resendOtp($data: ResendOTPRequest!) { resend_otp(params: $data) { message }}
				`,
				variables: { data },
			});

			return res.resend_otp;
		} catch (err) {
			throw err;
		}
	};

	resetPassword = async (
		data: Types.ResetPasswordInput,
	): Promise<Types.Response | void> => {
		try {
			const resetPasswordRes = await this.graphqlQuery({
				query: `mutation resetPassword($data: ResetPasswordInput!) {	reset_password(params: $data) { message } }`,
				variables: {
					data,
				},
			});
			return resetPasswordRes.reset_password;
		} catch (error) {
			throw error;
		}
	};

	revokeToken = async (data: { refresh_token: string }) => {
		if (!data.refresh_token && !data.refresh_token.trim()) {
			throw new Error(`Invalid refresh_token`);
		}

		const fetcher = getFetcher();
		const res = await fetcher(this.config.authorizerURL + '/oauth/revoke', {
			method: 'POST',
			headers: {
				...this.config.extraHeaders,
			},
			body: JSON.stringify({
				refresh_token: data.refresh_token,
				client_id: this.config.clientID,
			}),
		});

		return await res.json();
	};

	signup = async (data: Types.SignupInput): Promise<Types.AuthToken | void> => {
		try {
			const res = await this.graphqlQuery({
				query: `
					mutation signup($data: SignUpInput!) { signup(params: $data) { ${authTokenFragment}}}
				`,
				variables: { data },
			});

			return res.signup;
		} catch (err) {
			throw err;
		}
	};

	updateProfile = async (
		data: Types.UpdateProfileInput,
		headers?: Types.Headers,
	): Promise<Types.Response | void> => {
		try {
			const updateProfileRes = await this.graphqlQuery({
				query: `mutation updateProfile($data: UpdateProfileInput!) {	update_profile(params: $data) { message } }`,
				headers,
				variables: {
					data,
				},
			});

			return updateProfileRes.update_profile;
		} catch (error) {
			throw error;
		}
	};

	validateJWTToken = async (
		params?: Types.ValidateJWTTokenInput,
	): Promise<Types.ValidateJWTTokenResponse> => {
		try {
			const res = await this.graphqlQuery({
				query: `query validateJWTToken($params: ValidateJWTTokenInput!){validate_jwt_token(params: $params) { is_valid } }`,
				variables: {
					params,
				},
			});

			return res.validate_jwt_token;
		} catch (error) {
			throw error;
		}
	};

	verifyEmail = async (
		data: Types.VerifyEmailInput,
	): Promise<Types.AuthToken | void> => {
		try {
			const res = await this.graphqlQuery({
				query: `
					mutation verifyEmail($data: VerifyEmailInput!) { verify_email(params: $data) { ${authTokenFragment}}}
				`,
				variables: { data },
			});

			return res.verify_email;
		} catch (err) {
			throw err;
		}
	};

	verifyOtp = async (
		data: Types.VerifyOtpInput,
	): Promise<Types.AuthToken | void> => {
		try {
			const res = await this.graphqlQuery({
				query: `
					mutation verifyOtp($data: VerifyOTPRequest!) { verify_otp(params: $data) { ${authTokenFragment}}}
				`,
				variables: { data },
			});

			return res.verify_otp;
		} catch (err) {
			throw err;
		}
	};
}
