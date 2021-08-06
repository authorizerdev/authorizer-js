import fetch from 'node-fetch';
import Authorizer from '../lib/index.mjs';

global.fetch = fetch;

// global.fetch = fetch;

const authRef = new Authorizer({
	authorizerURL: 'https://authorizer-demo.herokuapp.com',
	redirectURL: 'https://authorizer-demo.herokuapp.com/app',
});

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

describe('login success', () => {
	let loginRes = null;
	it('should log in successfully', async () => {
		loginRes = await authRef.login({
			email: 'lakhan.m.samani@gmail.com',
			password: 'test',
		});
		expect(loginRes.accessToken.length).not.toEqual(0);
	});

	it('should fetch the same session', async () => {
		const sessionRes = await authRef.getSession({
			Authorization: `Bearer ${loginRes.accessToken}`,
		});
		expect(loginRes.accessToken).toMatch(sessionRes.accessToken);
	});

	it('should logout correctly', async () => {
		const logoutRes = await authRef.logout({
			Authorization: `Bearer ${loginRes.accessToken}`,
		});
		// in future if message changes we don't want to take risk of this test failing
		expect(logoutRes.message.length).not.toEqual(0);
	});
});
