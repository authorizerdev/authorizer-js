// Note: write gql query in single line to reduce bundle size
import nodeFetch from 'node-fetch';

export type ConfigType = {
	authorizerURL: string;
	redirectURL?: string;
};

export type User = {
	id: string;
	email: string;
	firstName?: string | null;
	lastName?: string | null;
	image?: string | null;
	signupMethod?: string | null;
	emailVerifiedAt?: number | null;
	roles?: [string];
};

export type AuthToken = {
	message?: string;
	accessToken: string;
	accessTokenExpiresAt: number;
	user?: User;
};

export type Response = {
	message: string;
};

export type Headers = Record<string, string>;

export type LoginInput = { email: string; password: string; role: [string] };

export type SignupInput = {
	email: string;
	password: string;
	confirmPassword: string;
	firstName?: string;
	lastName?: string;
	roles?: [string];
};

export type VerifyEmailInput = { token: string };

export type GraphqlQueryInput = {
	query: string;
	variables?: Record<string, any>;
	headers?: Headers;
};

export type MetaData = {
	version: string;
	isGoogleLoginEnabled: boolean;
	isFacebookLoginEnabled: boolean;
	isTwitterLoginEnabled: boolean;
	isGithubLoginEnabled: boolean;
	isEmailVerificationEnabled: boolean;
	isBasicAuthenticationEnabled: boolean;
};

export type UpdateProfileInput = {
	oldPassword?: string;
	newPassword?: string;
	confirmNewPassword?: string;
	firstName?: string;
	lastName?: string;
	image?: string;
	email?: string;
};

export type ForgotPasswordInput = {
	email: string;
};

export type ResetPasswordInput = {
	token: string;
	password: string;
	confirmPassword: string;
};

export enum OAuthProviders {
	Github = 'github',
	Google = 'google',
}

const hasWindow = (): boolean => typeof window !== 'undefined';

// re-usable gql response fragment
const userTokenFragment = `message accessToken accessTokenExpiresAt user { id email firstName lastName image }`;

export class Authorizer {
	// class variable
	config: ConfigType;

	// constructor
	constructor(config: ConfigType) {
		if (!config) {
			throw new Error(`Configuration is required`);
		}
		this.config = config;
		if (!config.authorizerURL.trim()) {
			throw new Error(`Invalid authorizerURL`);
		}
		if (config.authorizerURL) {
			const trimmedData = config.authorizerURL.trim();
			const lastChar = trimmedData[trimmedData.length - 1];
			if (lastChar === '/') {
				this.config.authorizerURL = trimmedData.slice(0, -1);
			} else {
				this.config.authorizerURL = trimmedData;
			}
		}
		if (!config.redirectURL) {
			throw new Error(`Invalid redirectURL`);
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
				query: `query { meta { version isGoogleLoginEnabled isGithubLoginEnabled isBasicAuthenticationEnabled isEmailVerificationEnabled isFacebookLoginEnabled isTwitterLoginEnabled } }`,
			});

			return res.meta;
		} catch (err) {
			throw err;
		}
	};

	// this is used to verify / get session using cookie by default. If using nodejs pass authorization header
	getSession = async (headers?: Headers, role?: string): Promise<AuthToken> => {
		try {
			const res = await this.graphqlQuery({
				query: `query getSession($role: String){token(role: $role) { ${userTokenFragment} } }`,
				headers,
				variables: {
					role,
				},
			});
			return res.token;
		} catch (err) {
			throw err;
		}
	};

	signup = async (data: SignupInput): Promise<AuthToken | void> => {
		try {
			const res = await this.graphqlQuery({
				query: `
		mutation signup($data: SignUpInput!) { signup(params: $data) { ${userTokenFragment}}}`,
				variables: { data },
			});

			return res.signup;
		} catch (err) {
			console.error(err);
		}
	};

	verifyEmail = async (data: VerifyEmailInput): Promise<AuthToken | void> => {
		try {
			const res = await this.graphqlQuery({
				query: `
		mutation verifyEmail($data: VerifyEmailInput!) { verifyEmail(params: $data) { ${userTokenFragment}}}`,
				variables: { data },
			});

			return res.verifyEmail;
		} catch (err) {
			console.error(err);
		}
	};

	login = async (data: LoginInput): Promise<AuthToken | void> => {
		try {
			const res = await this.graphqlQuery({
				query: `
		mutation login($data: LoginInput!) { login(params: $data) { ${userTokenFragment}}}`,
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
				query: `query {	profile { id email image firstName lastName emailVerifiedAt signupMethod } }`,
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
				query: `mutation updateProfile($data: UpdateProfileInput!) {	updateProfile(params: $data) { message } }`,
				headers,
				variables: {
					data,
				},
			});

			return updateProfileRes.updateProfile;
		} catch (error) {
			throw error;
		}
	};

	forgotPassword = async (
		data: ForgotPasswordInput,
	): Promise<Response | void> => {
		try {
			const forgotPasswordRes = await this.graphqlQuery({
				query: `mutation forgotPassword($data: ForgotPasswordInput!) {	forgotPassword(params: $data) { message } }`,
				variables: {
					data,
				},
			});

			return forgotPasswordRes.forgotPassword;
		} catch (error) {
			throw error;
		}
	};

	resetPassword = async (
		data: ResetPasswordInput,
	): Promise<Response | void> => {
		try {
			const resetPasswordRes = await this.graphqlQuery({
				query: `mutation resetPassword($data: ResetPasswordInput!) {	resetPassword(params: $data) { message } }`,
				variables: {
					data,
				},
			});
			return resetPasswordRes.resetPassword;
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
			window.location.href = `${this.config.authorizerURL}/app?state=${btoa(
				JSON.stringify(this.config),
			)}`;
		}
	};

	oauthLogin = async (oauthProvider: string, role?: string): Promise<void> => {
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
		window.location.href = `${
			this.config.authorizerURL
		}/oauth_login/${oauthProvider}?redirectURL=${
			this.config.redirectURL || window.location.origin
		}${role ? `&role=${role}` : ``}`;
	};

	logout = async (headers?: Headers): Promise<Response | void> => {
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
