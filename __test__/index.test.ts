import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { ApiResponse, AuthToken, Authorizer } from '../lib';

const authorizerConfig = {
  authorizerURL: 'http://localhost:8080',
  redirectURL: 'http://localhost:8080/app',
  clientID: '3fab5e58-5693-46f2-8123-83db8133cd22',
  adminSecret: 'secret',
};

const testConfig = {
  email: 'test@test.com',
  webHookId: '',
  webHookUrl: 'https://webhook.site/c28a87c1-f061-44e0-9f7a-508bc554576f',
  userId: '',
  emailTemplateId: '',
  password: 'Test@123#',
  maginLinkLoginEmail: 'test_magic_link@test.com',
};

// Using etheral.email for email sink: https://ethereal.email/create
const authorizerENV = {
  ENV: 'production',
  DATABASE_URL: 'data.db',
  DATABASE_TYPE: 'sqlite',
  CUSTOM_ACCESS_TOKEN_SCRIPT:
    'function(user,tokenPayload){var data = tokenPayload;data.extra = {\'x-extra-id\': user.id};return data;}',
  DISABLE_PLAYGROUND: 'true',
  SMTP_HOST: 'smtp.ethereal.email',
  SMTP_PASSWORD: 'WncNxwVFqb6nBjKDQJ',
  SMTP_USERNAME: 'sydnee.lesch77@ethereal.email',
  SMTP_PORT: '587',
  SENDER_EMAIL: 'test@authorizer.dev',
  ADMIN_SECRET: 'secret',
};

const verificationRequests = 'query {_verification_requests { verification_requests { id token email expires identifier } } }';

describe('Integration Tests - authorizer-js', () => {
  let container: StartedTestContainer;

  let authorizer: Authorizer;

  beforeAll(async () => {
    container = await new GenericContainer('lakhansamani/authorizer:latest')
      .withEnvironment(authorizerENV)
      .withExposedPorts(8080)
      .withWaitStrategy(Wait.forHttp('/userinfo', 8080).forStatusCode(401))
      .start();

    authorizerConfig.authorizerURL = `http://${container.getHost()}:${container.getFirstMappedPort()}`;
    authorizerConfig.redirectURL = `http://${container.getHost()}:${container.getFirstMappedPort()}/app`;

    authorizer = new Authorizer(authorizerConfig);
    // get metadata
    const metadataRes = await authorizer.getMetaData();
    expect(metadataRes?.data).toBeDefined();
    if (metadataRes?.data?.client_id) {
      authorizer.config.clientID = metadataRes?.data?.client_id;
    }
  });

  it('should signup with email verification enabled', async () => {
    const signupRes = await authorizer.signup({
      email: testConfig.email,
      password: testConfig.password,
      confirm_password: testConfig.password,
    });
    expect(signupRes?.data).toBeDefined();
    expect(signupRes?.errors).toHaveLength(0);
    expect(signupRes?.data?.message?.length).not.toEqual(0);
  });

  it('should verify email', async () => {
    const verificationRequestsRes = await authorizer.graphqlQuery({
      query: verificationRequests,
      variables: {},
      headers: {
        'x-authorizer-admin-secret': authorizerConfig.adminSecret,
      },
    });
    const requests =
      verificationRequestsRes?.data?._verification_requests
        .verification_requests;
    expect(verificationRequestsRes?.data).toBeDefined();
    expect(verificationRequestsRes?.errors).toHaveLength(0);
    const item = requests.find(
      (i: { email: string }) => i.email === testConfig.email
    );
    expect(item).not.toBeNull();

    const verifyEmailRes = await authorizer.verifyEmail({ token: item.token });
    expect(verifyEmailRes?.data).toBeDefined();
    expect(verifyEmailRes?.errors).toHaveLength(0);
    expect(verifyEmailRes?.data?.access_token?.length).toBeGreaterThan(0);
  });

  let loginRes:ApiResponse<AuthToken> | null;
  it('should log in successfully', async () => {
    loginRes = await authorizer.login({
      email: testConfig.email,
      password: testConfig.password,
      scope: ['openid', 'profile', 'email', 'offline_access'],
    });
    expect(loginRes?.data).toBeDefined();
    expect(loginRes?.errors).toHaveLength(0);
    expect(loginRes?.data?.access_token.length).not.toEqual(0);
    expect(loginRes?.data?.refresh_token?.length).not.toEqual(0);
    expect(loginRes?.data?.expires_in).not.toEqual(0);
    expect(loginRes?.data?.id_token.length).not.toEqual(0);
  });

  it('should validate jwt token', async () => {
    const validateRes = await authorizer.validateJWTToken({
      token_type: 'access_token',
      token: loginRes?.data?.access_token || '',
    });
    expect(validateRes?.data).toBeDefined();
    expect(validateRes?.errors).toHaveLength(0);
    expect(validateRes?.data?.is_valid).toEqual(true);
  });

  it('should update profile successfully', async () => {
    const updateProfileRes = await authorizer.updateProfile(
      {
        given_name: 'bob',
      },
      {
        Authorization: `Bearer ${loginRes?.data?.access_token}`,
      }
    );
    expect(updateProfileRes?.data).toBeDefined();
    expect(updateProfileRes?.errors).toHaveLength(0);
  });

  it('should fetch profile successfully', async () => {
    const profileRes = await authorizer.getProfile({
      Authorization: `Bearer ${loginRes?.data?.access_token}`,
    });
    expect(profileRes?.data).toBeDefined();
    expect(profileRes?.errors).toHaveLength(0);
    expect(profileRes?.data?.given_name).toMatch('bob');
  });

  it('should get access_token using refresh_token', async () => {
    const tokenRes = await authorizer.getToken({
      grant_type: 'refresh_token',
      refresh_token: loginRes?.data?.refresh_token,
    });
    expect(tokenRes?.data).toBeDefined();
    expect(tokenRes?.errors).toHaveLength(0);
    expect(tokenRes?.data?.access_token.length).not.toEqual(0);
    if (loginRes && loginRes.data) {
      loginRes.data.access_token = tokenRes?.data?.access_token || '';
    }
  });

  it('should deactivate account', async () => {
    const deactivateRes = await authorizer.deactivateAccount({
      Authorization: `Bearer ${loginRes?.data?.access_token}`,
    });
    expect(deactivateRes?.data).toBeDefined();
    expect(deactivateRes?.errors).toHaveLength(0);
  });

  it('should throw error while accessing profile after deactivation', async () => {
    const resp = await authorizer.getProfile({
      Authorization: `Bearer ${loginRes?.data?.access_token}`,
    });
    expect(resp?.data).toBeUndefined();
    expect(resp?.errors).toHaveLength(1);
  });

  describe('magic link login', () => {
    it('should login with magic link', async () => {
      const magicLinkLoginRes = await authorizer.magicLinkLogin({
        email: testConfig.maginLinkLoginEmail,
      });
      expect(magicLinkLoginRes?.data).toBeDefined();
      expect(magicLinkLoginRes?.errors).toHaveLength(0);
    });
    it('should verify email', async () => {
      const verificationRequestsRes = await authorizer.graphqlQuery({
        query: verificationRequests,
        headers: {
          'x-authorizer-admin-secret': authorizerConfig.adminSecret,
        },
      });
      const requests
        = verificationRequestsRes?.data?._verification_requests.verification_requests;
      const item = requests.find((i:{email: string}) => i.email === testConfig.maginLinkLoginEmail);
      expect(item).not.toBeNull();  
      const verifyEmailRes = await authorizer.verifyEmail({
        token: item.token,
      });
      expect(verifyEmailRes?.data).toBeDefined();
      expect(verifyEmailRes?.errors).toHaveLength(0);
      expect(verifyEmailRes?.data?.user?.signup_methods).toContain('magic_link_login');
    });
  });
});
