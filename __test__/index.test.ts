import { randomUUID } from 'node:crypto';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { ApiResponse, AuthToken, Authorizer } from '../lib';

jest.setTimeout(900000); // Integration tests can be slow on CI

const authorizerConfig: {
  authorizerURL: string;
  redirectURL: string;
  adminSecret: string;
  clientID?: string;
} = {
  authorizerURL: 'http://localhost:8080',
  redirectURL: 'http://localhost:8080/app',
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

// Build v2 CLI args for authorizer (see authorizer/cmd/root.go). Using etheral.email for email sink.
function buildAuthorizerCliArgs(): { args: string[]; clientId: string } {
  const clientId = randomUUID();
  const clientSecret = randomUUID();
  const jwtSecret = randomUUID();
  const customAccessTokenScript =
    "function(user,tokenPayload){var data = tokenPayload;data.extra = {'x-extra-id': user.id};return data;}";

  const args = [
    '--client-id',
    clientId,
    '--client-secret',
    clientSecret,
    '--jwt-type',
    'HS256',
    '--jwt-secret',
    jwtSecret,
    '--admin-secret',
    authorizerConfig.adminSecret,
    '--env',
    'production',
    '--database-type',
    'sqlite',
    '--database-url',
    '/tmp/authorizer.db',
    '--custom-access-token-script',
    customAccessTokenScript,
    '--enable-playground=false',
    '--log-level',
    'debug',
    '--smtp-host',
    'smtp.ethereal.email',
    '--smtp-port',
    '587',
    '--smtp-username',
    'sydnee.lesch77@ethereal.email',
    '--smtp-password',
    'WncNxwVFqb6nBjKDQJ',
    '--smtp-sender-email',
    'test@authorizer.dev',
    '--enable-email-verification=true',
    '--enable-magic-link-login=true',
  ];
  return { args, clientId };
}

// const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const verificationRequests =
  'query {_verification_requests { verification_requests { id token email expires identifier } } }';

describe('Integration Tests - authorizer-js', () => {
  let container: StartedTestContainer | undefined;

  let authorizer: Authorizer;

  beforeAll(async () => {
    const { args, clientId } = buildAuthorizerCliArgs();

    container = await new GenericContainer('lakhansamani/authorizer:2.0.0-rc.6')
      .withCommand(args)
      .withExposedPorts(8080)
      .withWaitStrategy(Wait.forHttp('/health', 8080).forStatusCode(200))
      .withStartupTimeout(900000) // 15 minutes (CI can be slow)
      // Surface container stdout/stderr to help diagnose CI startup failures.
      .withLogConsumer((chunk) => {
        // Avoid changing log format; just mirror what container prints.
        process.stdout.write(chunk.toString());
      })
      .start();

    authorizerConfig.authorizerURL = `http://${container.getHost()}:${container.getMappedPort(
      8080,
    )}`;
    authorizerConfig.redirectURL = `http://${container.getHost()}:${container.getMappedPort(
      8080,
    )}/app`;
    authorizerConfig.clientID = clientId;
    console.log('Authorizer URL:', authorizerConfig.authorizerURL);
    authorizer = new Authorizer(authorizerConfig);
  });

  afterAll(async () => {
    if (container) await container.stop();
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
      (i: { email: string }) => i.email === testConfig.email,
    );
    expect(item).not.toBeNull();
    expect(item?.token).toBeDefined();

    const verifyEmailRes = await authorizer.verifyEmail({ token: item.token });
    expect(verifyEmailRes?.data).toBeDefined();
    expect(verifyEmailRes?.errors).toHaveLength(0);
    expect(verifyEmailRes?.data?.access_token).toBeDefined();
    expect(verifyEmailRes?.data?.access_token).not.toBeNull();
    expect(verifyEmailRes?.data?.access_token?.length).toBeGreaterThan(0);
  });

  let loginRes: ApiResponse<AuthToken> | null;
  it('should log in successfully', async () => {
    loginRes = await authorizer.login({
      email: testConfig.email,
      password: testConfig.password,
      scope: ['openid', 'profile', 'email', 'offline_access'],
    });
    expect(loginRes?.data).toBeDefined();
    expect(loginRes?.errors).toHaveLength(0);
    expect(loginRes?.data?.access_token).toBeDefined();
    expect(loginRes?.data?.access_token).not.toBeNull();
    expect(loginRes?.data?.access_token?.length).toBeGreaterThan(0);
    expect(loginRes?.data?.refresh_token).toBeDefined();
    expect(loginRes?.data?.refresh_token).not.toBeNull();
    expect(loginRes?.data?.refresh_token?.length).toBeGreaterThan(0);
    expect(loginRes?.data?.expires_in).toBeDefined();
    expect(loginRes?.data?.expires_in).not.toBeNull();
    expect(loginRes?.data?.expires_in).toBeGreaterThan(0);
    expect(loginRes?.data?.id_token).toBeDefined();
    expect(loginRes?.data?.id_token).not.toBeNull();
    expect(loginRes?.data?.id_token?.length).toBeGreaterThan(0);
  });

  it('should validate jwt token', async () => {
    expect(loginRes?.data?.access_token).toBeDefined();
    expect(loginRes?.data?.access_token).not.toBeNull();
    const validateRes = await authorizer.validateJWTToken({
      token_type: 'access_token',
      token: loginRes?.data?.access_token || '',
    });
    expect(validateRes?.data).toBeDefined();
    expect(validateRes?.errors).toHaveLength(0);
    expect(validateRes?.data?.is_valid).toEqual(true);
  });

  it('should update profile successfully', async () => {
    expect(loginRes?.data?.access_token).toBeDefined();
    expect(loginRes?.data?.access_token).not.toBeNull();
    const updateProfileRes = await authorizer.updateProfile(
      {
        given_name: 'bob',
      },
      {
        Authorization: `Bearer ${loginRes?.data?.access_token}`,
      },
    );
    expect(updateProfileRes?.data).toBeDefined();
    expect(updateProfileRes?.errors).toHaveLength(0);
  });

  it('should fetch profile successfully', async () => {
    expect(loginRes?.data?.access_token).toBeDefined();
    expect(loginRes?.data?.access_token).not.toBeNull();
    const profileRes = await authorizer.getProfile({
      Authorization: `Bearer ${loginRes?.data?.access_token}`,
    });
    expect(profileRes?.data).toBeDefined();
    expect(profileRes?.errors).toHaveLength(0);
    expect(profileRes?.data?.given_name).toBeDefined();
    expect(profileRes?.data?.given_name).toMatch('bob');
  });

  it('should get access_token using refresh_token', async () => {
    expect(loginRes?.data?.refresh_token).toBeDefined();
    expect(loginRes?.data?.refresh_token).not.toBeNull();
    const tokenRes = await authorizer.getToken({
      grant_type: 'refresh_token',
      refresh_token: loginRes?.data?.refresh_token || '',
    });
    expect(tokenRes?.data).toBeDefined();
    expect(tokenRes?.errors).toHaveLength(0);
    expect(tokenRes?.data?.access_token).toBeDefined();
    expect(tokenRes?.data?.access_token?.length).toBeGreaterThan(0);
    if (loginRes && loginRes.data) {
      loginRes.data.access_token = tokenRes?.data?.access_token || '';
    }
  });

  it('should deactivate account', async () => {
    expect(loginRes?.data?.access_token).toBeDefined();
    expect(loginRes?.data?.access_token).not.toBeNull();
    const deactivateRes = await authorizer.deactivateAccount({
      Authorization: `Bearer ${loginRes?.data?.access_token}`,
    });
    expect(deactivateRes?.data).toBeDefined();
    expect(deactivateRes?.errors).toHaveLength(0);
  });

  it('should throw error while accessing profile after deactivation', async () => {
    expect(loginRes?.data?.access_token).toBeDefined();
    const resp = await authorizer.getProfile({
      Authorization: `Bearer ${loginRes?.data?.access_token}`,
    });
    expect(resp?.data).toBeUndefined();
    expect(resp?.errors).toBeDefined();
    expect(resp?.errors.length).toBeGreaterThan(0);
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
        (i: { email: string }) => i.email === testConfig.maginLinkLoginEmail,
      );
      expect(item).not.toBeNull();
      expect(item?.token).toBeDefined();
      const verifyEmailRes = await authorizer.verifyEmail({
        token: item.token,
      });
      expect(verifyEmailRes?.data).toBeDefined();
      expect(verifyEmailRes?.errors).toHaveLength(0);
      expect(verifyEmailRes?.data?.user).toBeDefined();
      expect(verifyEmailRes?.data?.user?.signup_methods).toBeDefined();
      expect(verifyEmailRes?.data?.user?.signup_methods).toContain(
        'magic_link_login',
      );
    });
  });
});
