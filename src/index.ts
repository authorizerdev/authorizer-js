// Note: write gql query in single line to reduce bundle size
import nodeFetch from 'node-fetch';
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
const userFragment = `id email email_verified given_name family_name middle_name nickname preferred_username picture signup_methods gender birthdate phone_number phone_number_verified roles created_at updated_at `;
const authTokenFragment = `message access_token expires_in refresh_token id_token user { ${userFragment} }`;

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

		this.config.clientID = config.clientID.trim();
	}

	getToken = async (data: {
		code?: string;
		grant_type?: string;
		refresh_token?: string;
	}) => {
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
			const res = await fetch(`${this.config.authorizerURL}/oauth/token`, {
				method: 'POST',
				body: JSON.stringify(requestData),
				headers: {
					'Content-Type': 'application/json',
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

	authorize = async (data: Types.AuthorizeInput) => {
		if (!hasWindow) {
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
					)}`,
				);
			}

			throw err;
		}
	};

	// helper to execute graphql queries
	// takes in any query or mutation string as input
	graphqlQuery = async (data: Types.GraphqlQueryInput) => {
		// set fetch based on window object. Isomorphic fetch doesn't support credentail: true
		// hence cookie based auth might not work so it is imp to use window.fetch in that case
		const f = hasWindow() ? window.fetch : nodeFetch;
		const res = await f(this.config.authorizerURL + '/graphql', {
			method: 'POST',
			body: JSON.stringify({
				query: data.query,
				variables: data.variables || {},
			}),
			headers: {
				'Content-Type': 'application/json',
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

	getMetaData = async (): Promise<Types.MetaData | void> => {
		try {
			const res = await this.graphqlQuery({
				query: `query { meta { version is_google_login_enabled is_facebook_login_enabled is_github_login_enabled is_email_verification_enabled is_basic_authentication_enabled is_magic_link_login_enabled } }`,
			});

			return res.meta;
		} catch (err) {
			throw err;
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

	magicLinkLogin = async (
		data: Types.MagicLinkLoginInput,
	): Promise<Response> => {
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
				)}`,
			);
		}
	};

	oauthLogin = async (
		oauthProvider: string,
		roles?: string[],
	): Promise<void> => {
		// @ts-ignore
		if (!Object.values(OAuthProviders).includes(oauthProvider)) {
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
			`${this.config.authorizerURL}/oauth_login/${oauthProvider}?redirectURL=${
				this.config.redirectURL || window.location.origin
			}${roles && roles.length ? `&roles=${roles.join(',')}` : ``}`,
		);
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
}
