// @ts-nocheck
const { Authorizer } = require('../lib')

const authRef = new Authorizer({
  authorizerURL: 'http://localhost:8080',
  redirectURL: 'http://localhost:8080/app',
  clientID: '19ccbbe2-7750-4aac-9d71-e2c75fbf660a',
})

const adminSecret = 'admin'
const password = 'Test@123#'
const email = 'uo5vbgg93p@yopmail.com'

describe('signup success', () => {
  it('should signup with email verification enabled', async () => {
    const signupRes = await authRef.signup({
      email,
      password,
      confirm_password: password,
    })
    expect(signupRes?.ok).toEqual(true)
    expect(signupRes?.response?.message?.length).not.toEqual(0)
  })

  it('should verify email', async () => {
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
    })

    const requests =
      verificationRequestsRes._verification_requests.verification_requests
    const item = requests.find((i) => i.email === email)
    expect(item).not.toBeNull()

    const verifyEmailRes = await authRef.verifyEmail({ token: item.token })

    expect(verifyEmailRes?.response?.access_token?.length).toBeGreaterThan(0)
  })
})

describe('login failures', () => {
  it('should throw password invalid error', async () => {

     const resp= await authRef.login({
        email,
        password: `${password}test`,
      })

      expect(resp?.error?.message).toContain('bad user credentials')
  })

  it('should throw password invalid role', async () => {

    const resp = await authRef.login({
      email,
      password,
      roles: ['admin'],
    })
    expect(resp.error?.message).toMatch('invalid role')
    expect(resp.ok).toBeFalsy()
  })

})

describe('forgot password success', () => {
  it('should create forgot password request', async () => {
    const forgotPasswordRes = await authRef.forgotPassword({
      email,
    })
    expect(forgotPasswordRes?.error?.message?.length).not.toEqual(0)
  })

  it('should reset password', async () => {
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
    })

    const requests =
      verificationRequestsRes._verification_requests.verification_requests
    const item = requests.find(
      (i) => i.email === email && i.identifier === 'forgot_password'
    )
    expect(item).not.toBeNull()
    if (item) {
      const resetPasswordRes = await authRef.resetPassword({
        token: item.token,
        password,
        confirm_password: password,
      })
      expect(resetPasswordRes?.error?.message?.length).not.toEqual(0)
    }
  })
})

describe('login success', () => {
  let loginRes = null
  it('should log in successfully', async () => {
    loginRes = await authRef.login({
      email,
      password,
      scope: ['openid', 'profile', 'email', 'offline_access'],
    })
    expect(loginRes?.response?.access_token.length).not.toEqual(0)
    expect(loginRes?.response?.refresh_token.length).not.toEqual(0)
    expect(loginRes?.response?.expires_in).not.toEqual(0)
    expect(loginRes?.response?.id_token.length).not.toEqual(0)
  })

  it('should validate jwt token', async () => {
    const validateRes = await authRef.validateJWTToken({
      token_type: 'access_token',
      token: loginRes.access_token,
    })
    expect(validateRes?.response?.is_valid).toEqual(true)
  })

  it('should update profile successfully', async () => {
    const updateProfileRes = await authRef.updateProfile(
      {
        given_name: 'bob',
      },
      {
        Authorization: `Bearer ${loginRes.access_token}`,
      }
    )
    expect(updateProfileRes?.error?.message?.length).not.toEqual(0)
  })

  it('should fetch profile successfully', async () => {
    const profileRes = await authRef.getProfile({
      Authorization: `Bearer ${loginRes?.response?.access_token}`,
    })
    expect(profileRes?.response?.given_name).toMatch('bob')
  })

  it('should validate get token', async () => {
    const tokenRes = await authRef.getToken({
      grant_type: 'refresh_token',
      refresh_token: loginRes.refresh_token,
    })
    expect(tokenRes?.response?.access_token.length).not.toEqual(0)
  })

  it('should deactivate account', async () => {
    console.log(`loginRes.access_token`, loginRes.access_token)
    const deactivateRes = await authRef.deactivateAccount({
      Authorization: `Bearer ${loginRes.access_token}`,
    })
    expect(deactivateRes?.error?.message?.length).not.toEqual(0)
  })

  it('should throw error while accessing profile after deactivation', async () => {
    const resp=await
      authRef.getProfile({
        Authorization: `Bearer ${loginRes.access_token}`,
      })
    expect(resp?.error?.message).toEqual('Error: unauthorized')
  })

  it('should clear data', async () => {
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
    })
  })
})

describe('magic login success', () => {
  it('should login with magic link', async () => {
    const magicLinkLoginRes = await authRef.magicLinkLogin({
      email,
    })

    expect(magicLinkLoginRes?.error?.message?.length).not.toEqual(0)
  })

  it('should verify email', async () => {
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
    })

    const requests =
      verificationRequestsRes._verification_requests.verification_requests

    const item = requests.find((i) => i.email === email)

    expect(item).not.toBeNull()

    const verifyEmailRes = await authRef.verifyEmail({
      token: item.token,
    })
    expect(verifyEmailRes.user.signup_methods).toContain('magic_link_login')
  })

  it('should clear data', async () => {
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
    })
  })
})
