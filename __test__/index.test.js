import fetch from 'node-fetch';
import Authorizer from '../lib/index.mjs';

global.fetch = fetch;

// global.fetch = fetch;

const authRef = new Authorizer({
	authorizerURL: 'http://localhost:8080',
	redirectURL: 'http://localhost:8080/app',
});

const adminSecret = 'admin';

describe('login failures', () => {
	it('should throw password invalid error', async () => {
		try {
			await authRef.login({
				email: 'lakhan.m.samani@gmail.com',
				password: 'test1',
			});
		} catch (e) {
			expect(e).toMatch('invalid password');
		}
	});
});

describe('signup success', () => {
	let randomEmail = `uo5vbgg93p@yopmail.com`;
	console.log(`Checking the sign up process for: ${randomEmail}`);
	it(`should signup with email verification enabled`, async () => {
		const signupRes = await authRef.signup({
			email: randomEmail,
			password: 'test',
			confirmPassword: 'test',
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
		const item = requests.find((i) => i.email === randomEmail);
		expect(item).not.toBeNull();

		const verifyEmailRes = await authRef.verifyEmail({ token: item.token });

		expect(verifyEmailRes.accessToken.length).not.toEqual(0);

		await authRef.graphqlQuery({
			query: `
				mutation {
					deleteUser(params: {
						email: "${randomEmail}"
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

describe('login success', () => {
	let loginRes = null;
	let headers = null;
	it('should log in successfully', async () => {
		loginRes = await authRef.login({
			email: 'lakhan.m.samani@gmail.com',
			password: 'test',
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
				firstName: 'lakhan1',
			},
			headers,
		);
		expect(updateProfileRes.message.length).not.toEqual(0);
	});

	it('should fetch profile successfully', async () => {
		const profileRes = await authRef.getProfile(headers);
		expect(profileRes.firstName).toMatch(`lakhan1`);
		await authRef.updateProfile(
			{
				firstName: 'Lakhan',
			},
			headers,
		);
	});

	it('should logout successfully', async () => {
		const logoutRes = await authRef.logout(headers);
		// in future if message changes we don't want to take risk of this test failing
		expect(logoutRes.message.length).not.toEqual(0);
	});
});
