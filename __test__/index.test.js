const { Authorizer } = require('../lib/cjs');

const authRef = new Authorizer({
	authorizerURL: 'http://localhost:8080',
	redirectURL: 'http://localhost:8080/app',
});

const adminSecret = 'admin';
const password = `some_random_password`;
const email = `uo5vbgg93p@yopmail.com`;

describe('signup success', () => {
	console.log(`Checking the sign up process for: ${email}`);
	it(`should signup with email verification enabled`, async () => {
		const signupRes = await authRef.signup({
			email: email,
			password: password,
			confirmPassword: password,
		});
		expect(signupRes.message.length).not.toEqual(0);
	});

	it(`should verify email`, async () => {
		const verificationRequestsRes = await authRef.graphqlQuery({
			query: `
				query {
					verificationRequests {
						id
						token
						email
						expires
						identifier
					}
				}
			`,
			headers: {
				'x-authorizer-admin-secret': adminSecret,
			},
		});

		const requests = verificationRequestsRes.verificationRequests;
		const item = requests.find((i) => i.email === email);
		expect(item).not.toBeNull();

		const verifyEmailRes = await authRef.verifyEmail({ token: item.token });

		expect(verifyEmailRes.accessToken.length).not.toEqual(0);
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
				role: 'admin',
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
					verificationRequests {
						id
						token
						email
						expires
						identifier
					}
				}
			`,
			headers: {
				'x-authorizer-admin-secret': adminSecret,
			},
		});

		const requests = verificationRequestsRes.verificationRequests;
		const item = requests.find(
			(i) => i.email === email && i.identifier === 'forgot_password',
		);
		expect(item).not.toBeNull();

		const resetPasswordRes = await authRef.resetPassword({
			token: item.token,
			password: password,
			confirmPassword: password,
		});

		expect(resetPasswordRes.message.length).not.toEqual(0);
	});
});

describe('login success', () => {
	let loginRes = null;
	let headers = null;
	it('should log in successfully', async () => {
		loginRes = await authRef.login({
			email: email,
			password: password,
		});
		expect(loginRes.accessToken.length).not.toEqual(0);
		headers = {
			Authorization: `Bearer ${loginRes.accessToken}`,
		};
	});

	it('should fetch the session successfully', async () => {
		const sessionRes = await authRef.getSession(headers);
		expect(loginRes.accessToken).toMatch(sessionRes.accessToken);
	});

	it('should update profile successfully', async () => {
		const updateProfileRes = await authRef.updateProfile(
			{
				firstName: 'bob',
			},
			headers,
		);
		expect(updateProfileRes.message.length).not.toEqual(0);
	});

	it('should fetch profile successfully', async () => {
		const profileRes = await authRef.getProfile(headers);
		expect(profileRes.firstName).toMatch(`bob`);
	});

	it('should logout successfully', async () => {
		const logoutRes = await authRef.logout(headers);
		// in future if message changes we don't want to take risk of this test failing
		expect(logoutRes.message.length).not.toEqual(0);

		await authRef.graphqlQuery({
			query: `
				mutation {
					deleteUser(params: {
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
