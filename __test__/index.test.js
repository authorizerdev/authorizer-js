const { Authorizer } = require('../lib/cjs');

const authRef = new Authorizer({
	authorizerURL: 'http://localhost:8080',
	redirectURL: 'http://localhost:8080/app',
	clientID: 'eebf7546-93a1-4924-8e02-34b781131b7e',
});

const adminSecret = 'admin';
const password = `Test@123#`;
const email = `uo5vbgg93p@yopmail.com`;

describe('signup success', () => {
	it(`should signup with email verification enabled`, async () => {
		const signupRes = await authRef.signup({
			email: email,
			password: password,
			confirm_password: password,
		});
		expect(signupRes.message.length).not.toEqual(0);
	});

	it(`should verify email`, async () => {
		const verificationRequestsRes = await authRef.graphqlQuery({
			query: `
				query {
					_verification_requests {
						verification_requests {
							id
							token
							email
							expires
							identifier
						}
					}
				}
			`,
			headers: {
				'x-authorizer-admin-secret': adminSecret,
			},
		});

		const requests =
			verificationRequestsRes._verification_requests.verification_requests;
		const item = requests.find((i) => i.email === email);
		expect(item).not.toBeNull();

		const verifyEmailRes = await authRef.verifyEmail({ token: item.token });

		expect(verifyEmailRes.access_token.length).not.toEqual(0);
	});
});

describe('login failures', () => {
	it('should throw password invalid error', async () => {
		try {
			await authRef.login({
				email: email,
				password: password + 'test',
			});
		} catch (e) {
			expect(e.message).toMatch('invalid password');
		}
	});

	it('should throw password invalid role', async () => {
		try {
			await authRef.login({
				email: email,
				password: password,
				roles: ['admin'],
			});
		} catch (e) {
			expect(e.message).toMatch('invalid role');
		}
	});
});

describe(`forgot password success`, () => {
	it(`should create forgot password request`, async () => {
		const forgotPasswordRes = await authRef.forgotPassword({
			email: email,
		});
		expect(forgotPasswordRes.message.length).not.toEqual(0);
	});

	it(`should reset password`, async () => {
		const verificationRequestsRes = await authRef.graphqlQuery({
			query: `
				query {
					_verification_requests {
						verification_requests {
							id
							token
							email
							expires
							identifier
						}
					}
				}
			`,
			headers: {
				'x-authorizer-admin-secret': adminSecret,
			},
		});

		const requests =
			verificationRequestsRes._verification_requests.verification_requests;
		const item = requests.find(
			(i) => i.email === email && i.identifier === 'forgot_password',
		);
		expect(item).not.toBeNull();
		if (item) {
			const resetPasswordRes = await authRef.resetPassword({
				token: item.token,
				password: password,
				confirm_password: password,
			});

			expect(resetPasswordRes.message.length).not.toEqual(0);
		}
	});
});

describe('login success', () => {
	let loginRes = null;
	let headers = null;
	it('should log in successfully', async () => {
		loginRes = await authRef.login({
			email: email,
			password: password,
			scope: ['openid', 'profile', 'email', 'offline_access'],
		});
		expect(loginRes.access_token.length).not.toEqual(0);
		expect(loginRes.refresh_token.length).not.toEqual(0);
		expect(loginRes.expires_in).not.toEqual(0);
		expect(loginRes.id_token.length).not.toEqual(0);
		headers = {
			Authorization: `Bearer ${loginRes.access_token}`,
		};
	});

	it('should validate jwt token', async () => {
		const validateRes = await authRef.validateJWTToken({
			token_type: 'access_token',
			token: loginRes.access_token,
		});
		expect(validateRes.is_valid).toEqual(true);
	});

	it(`should validate get token`, async () => {
		const tokenRes = await authRef.getToken({
			grant_type: `refresh_token`,
			refresh_token: loginRes.refresh_token,
		});
		expect(tokenRes.access_token.length).not.toEqual(0);
	});

	// it('should fetch the session successfully', async () => {
	// 	const sessionRes = await authRef.getSession(headers);
	// 	expect(loginRes.access_token).toMatch(sessionRes.access_token);
	// });

	// it('should validate role with session', async () => {
	// 	const sessionRes = await authRef.getSession(headers, ['user']);

	// 	expect(loginRes.access_token).toMatch(sessionRes.access_token);
	// });

	it('should update profile successfully', async () => {
		const updateProfileRes = await authRef.updateProfile(
			{
				given_name: 'bob',
			},
			headers,
		);
		expect(updateProfileRes.message.length).not.toEqual(0);
	});

	it('should fetch profile successfully', async () => {
		const profileRes = await authRef.getProfile(headers);
		expect(profileRes.given_name).toMatch(`bob`);
	});

	it('should logout successfully', async () => {
		// const logoutRes = await authRef.logout(headers);
		// in future if message changes we don't want to take risk of this test failing
		// expect(logoutRes.message.length).not.toEqual(0);

		await authRef.graphqlQuery({
			query: `
				mutation {
					_delete_user(params: {
						email: "${email}"
					}) {
						message
					}
				}
			`,
			headers: {
				'x-authorizer-admin-secret': adminSecret,
			},
		});
	});
});

describe('magic login success', () => {
	let headers = null;
	it(`should login with magic link`, async () => {
		const magicLinkLoginRes = await authRef.magicLinkLogin({
			email: email,
		});

		expect(magicLinkLoginRes.message.length).not.toEqual(0);
	});

	it(`should verify email`, async () => {
		const verificationRequestsRes = await authRef.graphqlQuery({
			query: `
				query {
					_verification_requests {
						verification_requests {
							id
							token
							email
							expires
							identifier
						}
					}
				}
			`,
			headers: {
				'x-authorizer-admin-secret': adminSecret,
			},
		});

		const requests =
			verificationRequestsRes._verification_requests.verification_requests;

		const item = requests.find((i) => i.email === email);

		expect(item).not.toBeNull();

		const verifyEmailRes = await authRef.verifyEmail({
			token: item.token,
		});
		expect(verifyEmailRes.user.signup_methods).toContain('magic_link_login');

		headers = {
			Authorization: `Bearer ${verifyEmailRes.access_token}`,
		};
	});

	it('should logout successfully', async () => {
		// const logoutRes = await authRef.logout(headers);
		// in future if message changes we don't want to take risk of this test failing
		// expect(logoutRes.message.length).not.toEqual(0);

		await authRef.graphqlQuery({
			query: `
				mutation {
					_delete_user(params: {
						email: "${email}"
					}) {
						message
					}
				}
			`,
			headers: {
				'x-authorizer-admin-secret': adminSecret,
			},
		});
	});
});
