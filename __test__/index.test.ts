import { randomUUID } from 'node:crypto';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { ApiResponse, AuthToken, Authorizer } from '../lib';

jest.setTimeout(1200000); // Integration tests can be slow on CI (20 minutes)

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
  'query _verification_requests { _verification_requests { verification_requests { id token email expires identifier } } }';

describe('Integration Tests - authorizer-js', () => {
  let container: StartedTestContainer | undefined;

  let authorizer: Authorizer;

  beforeAll(async () => {
    const { args, clientId } = buildAuthorizerCliArgs();

    // Override with AUTHORIZER_IMAGE to test against a different server build
    // (e.g. a locally built image with newer GraphQL surface).
    container = await new GenericContainer(
      process.env.AUTHORIZER_IMAGE || 'lakhansamani/authorizer:2.0.0-rc.6',
    )
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
    authorizer = new Authorizer({
      ...authorizerConfig,
      // Node sends no implicit Origin header; newer server builds enforce
      // CSRF on state-changing requests (Origin must match the server host).
      // Browsers set this automatically, so this only affects node tests.
      extraHeaders: { Origin: authorizerConfig.authorizerURL },
    });
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
      operationName: '_verification_requests',
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

  // ---- Fine-grained authorization (FGA) ----
  //
  // The embedded OpenFGA engine auto-enables when the main database is
  // SQL-compatible (this container runs sqlite), so the fga_* surface is live
  // out of the box on FGA-capable servers. Older server images predate the
  // fga_* GraphQL fields entirely; the probe in the setup test detects that
  // and the FGA assertions no-op with a warning instead of failing — they
  // light up automatically once AUTHORIZER_IMAGE points at an FGA-capable
  // build.
  //
  // Model/tuple authoring is an admin concern and deliberately NOT part of
  // the SDK surface; the setup below uses the raw `graphqlQuery` escape hatch
  // with the admin secret, mirroring how the dashboard drives the `_fga_*`
  // admin API.
  let fgaSupported = false;

  const fgaModelDsl = `model
  schema 1.1
type user
type document
  relations
    define viewer: [user]
    define can_view: viewer
`;

  const fgaSkipWarning = () =>
    console.warn(
      'Skipping FGA assertions: server image has no fga_* GraphQL surface. Set AUTHORIZER_IMAGE to an FGA-capable build to run them.',
    );

  it('should install an FGA model and grant a tuple (admin setup)', async () => {
    expect(loginRes?.data?.access_token).toBeDefined();
    expect(loginRes?.data?.access_token).not.toBeNull();

    // Probe: a server without FGA fails GraphQL validation on the fga_check
    // field ("Cannot query field"); any other outcome (data or an engine /
    // auth error) proves the surface exists.
    const probe = await authorizer.graphqlQuery({
      query:
        'query fgaProbe { fga_check(params: { relation: "viewer", object: "document:probe" }) { allowed } }',
      headers: { Authorization: `Bearer ${loginRes?.data?.access_token}` },
      operationName: 'fgaProbe',
    });
    fgaSupported = !probe?.errors?.some((e) =>
      e?.message?.includes('Cannot query field'),
    );
    if (!fgaSupported) {
      fgaSkipWarning();
      return;
    }

    const adminHeaders = {
      'x-authorizer-admin-secret': authorizerConfig.adminSecret,
    };

    // Install a minimal model: viewer is granted directly, can_view derives
    // from it.
    const modelRes = await authorizer.graphqlQuery({
      query:
        'mutation fgaWriteModel($params: FgaWriteModelInput!) { _fga_write_model(params: $params) { id dsl } }',
      variables: { params: { dsl: fgaModelDsl } },
      headers: adminHeaders,
      operationName: 'fgaWriteModel',
    });
    expect(modelRes?.errors).toHaveLength(0);
    expect(modelRes?.data?._fga_write_model?.id).toBeDefined();

    // The runtime checks pin the subject to the caller's token sub (the user
    // id), so the granted tuple must reference it.
    const profileRes = await authorizer.getProfile({
      Authorization: `Bearer ${loginRes?.data?.access_token}`,
    });
    expect(profileRes?.errors).toHaveLength(0);
    testConfig.userId = profileRes?.data?.id || '';
    expect(testConfig.userId.length).toBeGreaterThan(0);

    const tuplesRes = await authorizer.graphqlQuery({
      query:
        'mutation fgaWriteTuples($params: FgaWriteTuplesInput!) { _fga_write_tuples(params: $params) { message } }',
      variables: {
        params: {
          tuples: [
            {
              user: `user:${testConfig.userId}`,
              relation: 'viewer',
              object: 'document:fga-doc-1',
            },
          ],
        },
      },
      headers: adminHeaders,
      operationName: 'fgaWriteTuples',
    });
    expect(tuplesRes?.errors).toHaveLength(0);
  });

  it('should allow fgaCheck for a granted relation and deny otherwise', async () => {
    if (!fgaSupported) return fgaSkipWarning();
    const authHeaders = {
      Authorization: `Bearer ${loginRes?.data?.access_token}`,
    };

    // can_view derives from the granted viewer tuple.
    const allowedRes = await authorizer.fgaCheck(
      { relation: 'can_view', object: 'document:fga-doc-1' },
      authHeaders,
    );
    expect(allowedRes?.errors).toHaveLength(0);
    expect(allowedRes?.data?.allowed).toEqual(true);

    // Nothing grants doc-2 — a clean deny (allowed=false), not an error.
    const deniedRes = await authorizer.fgaCheck(
      { relation: 'can_view', object: 'document:fga-doc-2' },
      authHeaders,
    );
    expect(deniedRes?.errors).toHaveLength(0);
    expect(deniedRes?.data?.allowed).toEqual(false);
  });

  it('should honor contextual tuples in fgaCheck', async () => {
    if (!fgaSupported) return fgaSkipWarning();
    // The contextual tuple grants viewer on doc-2 for this single evaluation
    // only; nothing is persisted.
    const res = await authorizer.fgaCheck(
      {
        relation: 'can_view',
        object: 'document:fga-doc-2',
        contextual_tuples: [
          {
            user: `user:${testConfig.userId}`,
            relation: 'viewer',
            object: 'document:fga-doc-2',
          },
        ],
      },
      { Authorization: `Bearer ${loginRes?.data?.access_token}` },
    );
    expect(res?.errors).toHaveLength(0);
    expect(res?.data?.allowed).toEqual(true);
  });

  it('should return positional results from fgaBatchCheck', async () => {
    if (!fgaSupported) return fgaSkipWarning();
    const res = await authorizer.fgaBatchCheck(
      {
        checks: [
          { relation: 'can_view', object: 'document:fga-doc-1' },
          { relation: 'can_view', object: 'document:fga-doc-2' },
        ],
      },
      { Authorization: `Bearer ${loginRes?.data?.access_token}` },
    );
    expect(res?.errors).toHaveLength(0);
    expect(res?.data?.results).toHaveLength(2);
    expect(res?.data?.results?.[0]?.allowed).toEqual(true);
    expect(res?.data?.results?.[1]?.allowed).toEqual(false);
  });

  it('should list accessible objects via fgaListObjects', async () => {
    if (!fgaSupported) return fgaSkipWarning();
    const res = await authorizer.fgaListObjects(
      { relation: 'can_view', object_type: 'document' },
      { Authorization: `Bearer ${loginRes?.data?.access_token}` },
    );
    expect(res?.errors).toHaveLength(0);
    expect(res?.data?.objects).toEqual(['document:fga-doc-1']);
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
        operationName: '_verification_requests',
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
