// Note: write gql query in single line to reduce bundle size
import nodeFetch from 'node-fetch';

export type ConfigType = {
	authorizerURL: string;
	redirectURL: string;
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
	picture?: string | null;
	gender?: string | null;
	birthdate?: string | null;
	phone_number?: string | null;
	phone_number_verified?: boolean | null;
	roles?: string[];
	created_at: number;
	updated_at: number;
};

export type AuthToken = {
	message?: string;
	access_token: string;
	expires_at: number;
	user?: User;
};

export type Response = {
	message: string;
};

export type Headers = Record<string, string>;

export type LoginInput = { email: string; password: string; roles?: string[] };

export type SignupInput = {
	email: string;
	password: string;
	confirm_password: string;
	given_name?: string;
	family_name?: string;
	middle_name?: string;
	picture?: string;
	gender?: string;
	birthdate?: string;
	phone_number?: string;
	roles?: string[];
};

export type MagicLinkLoginInput = {
	email: string;
	roles?: string[];
};

export type VerifyEmailInput = { token: string };

export type GraphqlQueryInput = {
	query: string;
	variables?: Record<string, any>;
	headers?: Headers;
};

export type MetaData = {
	version: string;
	is_google_login_enabled: boolean;
	is_facebook_login_enabled: boolean;
	is_github_login_enabled: boolean;
	is_email_verification_enabled: boolean;
	is_basic_authentication_enabled: boolean;
	is_magic_link_login_enabled: boolean;
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
};

export type ForgotPasswordInput = {
	email: string;
};

export type ResetPasswordInput = {
	token: string;
	password: string;
	confirm_password: string;
};

export enum OAuthProviders {
	Github = 'github',
	Google = 'google',
	Facebook = 'facebook',
}

const hasWindow = (): boolean => typeof window !== 'undefined';

// re-usable gql response fragment
const userFragment = `id email email_verified given_name family_name middle_name nickname preferred_username picture signup_methods gender birthdate phone_number phone_number_verified roles created_at updated_at `;
const authTokenFragment = `message access_token expires_at user { ${userFragment} }`;

const trimURL = (url: string): string => {
	let trimmedData = url.trim();
	const lastChar = trimmedData[trimmedData.length - 1];
	if (lastChar === '/') {
		trimmedData = trimmedData.slice(0, -1);
	} else {
		trimmedData = trimmedData;
	}

	return trimmedData;
};

export class Authorizer {
	// class variable
	config: ConfigType;

	// constructor
	constructor(config: ConfigType) {
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
	}

	// helper to execute graphql queries
	// takes in any query or mutation string as input
	graphqlQuery = async (data: GraphqlQueryInput) => {
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

	getMetaData = async (): Promise<MetaData | void> => {
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
		headers?: Headers,
		roles?: string[],
	): Promise<AuthToken> => {
		try {
			const res = await this.graphqlQuery({
				query: `query getSession($roles: [String!]){session(roles: $roles) { ${authTokenFragment} } }`,
				headers,
				variables: {
					roles,
				},
			});
			return res.session;
		} catch (err) {
			throw err;
		}
	};

	magicLinkLogin = async (data: MagicLinkLoginInput): Promise<Response> => {
		try {
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

	signup = async (data: SignupInput): Promise<AuthToken | void> => {
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

	verifyEmail = async (data: VerifyEmailInput): Promise<AuthToken | void> => {
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

	login = async (data: LoginInput): Promise<AuthToken | void> => {
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

	getProfile = async (headers?: Headers): Promise<User | void> => {
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
		data: UpdateProfileInput,
		headers?: Headers,
	): Promise<Response | void> => {
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
		data: ForgotPasswordInput,
	): Promise<Response | void> => {
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
		data: ResetPasswordInput,
	): Promise<Response | void> => {
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

	browserLogin = async (): Promise<AuthToken | void> => {
		try {
			const token = await this.getSession();
			return token;
		} catch (err) {
			if (!hasWindow()) {
				throw new Error(`browserLogin is only supported for browsers`);
			}
			window.location.replace(
				`${this.config.authorizerURL}/app?state=${btoa(
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

	logout = async (headers?: Headers): Promise<Response | void> => {
		try {
			const res = await this.graphqlQuery({
				query: ` mutation { logout { message } } `,
				headers,
			});
			return res.logout;
		} catch (err) {
			console.log(`logout err:`, err);
			console.error(err);
		}
	};
}
