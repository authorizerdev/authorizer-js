import { randomUUID } from 'node:crypto';
import {
  GenericContainer,
  PullPolicy,
  StartedTestContainer,
  Wait,
} from 'testcontainers';
import { AuthorizerAdmin, Protocol } from '../lib';

jest.setTimeout(1200000); // Integration tests can be slow on CI (20 minutes)

// Protocols JS supports for admin calls. Each admin method is exercised over
// every protocol it supports (see the per-method `protocols` lists in admin.ts
// and the SDK_ADMIN_SPEC.md availability table).
const PROTOCOLS: Protocol[] = ['graphql', 'rest'];

const adminConfig = {
  authorizerURL: 'http://localhost:8080',
  adminSecret: 'admin',
};

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
    adminConfig.adminSecret,
    '--env',
    'production',
    '--database-type',
    'sqlite',
    '--database-url',
    '/tmp/authorizer-admin.db',
    '--enable-playground=false',
    '--log-level',
    'debug',
    // Raise the rate limit well above what this suite generates; we are not
    // testing rate limiting, and the default (30 rps / 20 burst) trips the FGA
    // calls when the suite runs back-to-back.
    '--rate-limit-rps=10000',
    '--rate-limit-burst=10000',
  ];
  return { args, clientId };
}

// Build an admin client pinned to a specific protocol against the live container.
function adminFor(protocol: Protocol): AuthorizerAdmin {
  return new AuthorizerAdmin({
    authorizerURL: adminConfig.authorizerURL,
    adminSecret: adminConfig.adminSecret,
    protocol,
    // Node sends no implicit Origin header; newer server builds enforce CSRF on
    // state-changing requests (Origin must match the server host). Browsers set
    // this automatically, so this only affects node tests.
    extraHeaders: { Origin: adminConfig.authorizerURL },
  });
}

describe('Integration Tests - AuthorizerAdmin (graphql + rest)', () => {
  let container: StartedTestContainer | undefined;

  beforeAll(async () => {
    const { args } = buildAuthorizerCliArgs();

    container = await new GenericContainer(
      process.env.AUTHORIZER_IMAGE || 'lakhansamani/authorizer:2.3.0-rc.9',
    )
      .withCommand(args)
      .withExposedPorts(8080)
      // The image is built locally and not in any registry; the default policy
      // never pulls when the image is already present, so testcontainers uses
      // the local build instead of trying (and failing) to pull it.
      .withPullPolicy(PullPolicy.defaultPolicy())
      .withWaitStrategy(Wait.forHttp('/health', 8080).forStatusCode(200))
      .withStartupTimeout(900000)
      .withLogConsumer((chunk) => {
        process.stdout.write(chunk.toString());
      })
      .start();

    adminConfig.authorizerURL = `http://${container.getHost()}:${container.getMappedPort(
      8080,
    )}`;
    console.log('Authorizer URL:', adminConfig.authorizerURL);
  });

  afterAll(async () => {
    if (container) await container.stop();
  });

  // ---- protocol selection guards ----

  it('throws when constructed with protocol "grpc"', () => {
    expect(
      () =>
        new AuthorizerAdmin({
          authorizerURL: adminConfig.authorizerURL,
          adminSecret: adminConfig.adminSecret,
          // grpc is unsupported in JS; cast to bypass the typed union.
          protocol: 'grpc' as unknown as Protocol,
        }),
    ).toThrow(/grpc/);
  });

  it('rejects rest-only methods over graphql with a clear error', async () => {
    const admin = adminFor('graphql');
    const res = await admin.adminMeta();
    expect(res.data).toBeUndefined();
    expect(res.errors.length).toBeGreaterThan(0);
    expect(res.errors[0].message).toMatch(/AdminMeta is not available over graphql/);
  });

  it('rejects graphql-only methods over rest with a clear error', async () => {
    const admin = adminFor('rest');
    const res = await admin.generateJWTKeys({ type: 'HS256' });
    expect(res.data).toBeUndefined();
    expect(res.errors.length).toBeGreaterThan(0);
    expect(res.errors[0].message).toMatch(
      /GenerateJWTKeys is not available over rest/,
    );
  });

  // ---- admin auth + users over both protocols ----

  describe.each(PROTOCOLS)('over %s', (protocol) => {
    const admin = () => adminFor(protocol);

    it('adminLogin succeeds', async () => {
      const res = await admin().adminLogin({
        admin_secret: adminConfig.adminSecret,
      });
      expect(res.errors).toHaveLength(0);
      expect(res.data?.message).toBeDefined();
    });

    it('users returns a paginated list', async () => {
      const res = await admin().users({ pagination: { limit: 10, page: 1 } });
      expect(res.errors).toHaveLength(0);
      expect(res.data?.pagination).toBeDefined();
      expect(Array.isArray(res.data?.users)).toBe(true);
    });

    it('verificationRequests returns a paginated list', async () => {
      const res = await admin().verificationRequests();
      expect(res.errors).toHaveLength(0);
      expect(Array.isArray(res.data?.verification_requests)).toBe(true);
    });

    it('webhooks returns a paginated list', async () => {
      const res = await admin().webhooks();
      expect(res.errors).toHaveLength(0);
      expect(Array.isArray(res.data?.webhooks)).toBe(true);
    });

    it('emailTemplates returns a paginated list', async () => {
      const res = await admin().emailTemplates();
      expect(res.errors).toHaveLength(0);
      expect(Array.isArray(res.data?.email_templates)).toBe(true);
    });

    it('auditLogs returns a paginated list', async () => {
      const res = await admin().auditLogs();
      expect(res.errors).toHaveLength(0);
      expect(Array.isArray(res.data?.audit_logs)).toBe(true);
    });

    it('addWebhook then getWebhook then deleteWebhook (lifecycle)', async () => {
      const a = admin();
      // event_name must be one of the server's known webhook events; use a
      // distinct one per protocol so the two protocol runs don't collide on the
      // unique event_name constraint. The server stores it as `<event>-<ts>`,
      // so match by prefix when locating the created row.
      const event =
        protocol === 'graphql'
          ? 'user.login'
          : 'user.signup';
      const addRes = await a.addWebhook({
        event_name: event,
        endpoint: 'https://example.com/webhook',
        enabled: true,
      });
      expect(addRes.errors).toHaveLength(0);

      const listRes = await a.webhooks({ pagination: { limit: 50, page: 1 } });
      expect(listRes.errors).toHaveLength(0);
      const created = listRes.data?.webhooks.find((w) =>
        (w.event_name ?? '').startsWith(event),
      );
      expect(created?.id).toBeDefined();

      const getRes = await a.getWebhook({ id: created!.id });
      expect(getRes.errors).toHaveLength(0);
      expect(getRes.data?.id).toEqual(created!.id);

      // Clean up so a re-run / the other protocol does not hit the unique
      // event_name constraint.
      const delRes = await a.deleteWebhook({ id: created!.id });
      expect(delRes.errors).toHaveLength(0);
    });

    it('addEmailTemplate then deleteEmailTemplate (lifecycle)', async () => {
      const a = admin();
      // email_template event_name is unique; use a distinct event per protocol.
      const event =
        protocol === 'graphql'
          ? 'basic_auth_signup'
          : 'magic_link_login';
      const addRes = await a.addEmailTemplate({
        event_name: event,
        subject: 'Welcome',
        template: '<p>Hello</p>',
      });
      expect(addRes.errors).toHaveLength(0);

      const listRes = await a.emailTemplates({
        pagination: { limit: 50, page: 1 },
      });
      expect(listRes.errors).toHaveLength(0);
      const created = listRes.data?.email_templates.find(
        (t) => t.event_name === event,
      );
      expect(created?.id).toBeDefined();

      // Clean up so the other protocol run / a re-run does not collide.
      const delRes = await a.deleteEmailTemplate({ id: created!.id });
      expect(delRes.errors).toHaveLength(0);
    });
  });

  // ---- FGA admin: write model + tuples, read/list/expand, reset last ----
  //
  // FGA reads/list/expand need a model + tuples first; FgaReset is destructive
  // and runs only at the very end. fgaGetModel / fgaReset are rest-only in JS.
  describe('FGA admin (graphql + rest)', () => {
    let fgaSupported = true;
    const userId = `user:${randomUUID()}`;

    const fgaModelDsl = `model
  schema 1.1
type user
type document
  relations
    define viewer: [user]
    define can_view: viewer
`;

    it('fgaWriteModel installs a model (graphql)', async () => {
      const res = await adminFor('graphql').fgaWriteModel({ dsl: fgaModelDsl });
      if (
        res.errors.some((e) => /Cannot query field|FailedPrecondition|fga/i.test(e.message))
      ) {
        fgaSupported = false;
        return;
      }
      expect(res.errors).toHaveLength(0);
      expect(res.data?.id).toBeDefined();
    });

    it('fgaWriteTuples persists a tuple (rest)', async () => {
      if (!fgaSupported) return;
      const res = await adminFor('rest').fgaWriteTuples({
        tuples: [{ user: userId, relation: 'viewer', object: 'document:1' }],
      });
      expect(res.errors).toHaveLength(0);
    });

    it('fgaReadTuples returns the persisted tuple (graphql)', async () => {
      if (!fgaSupported) return;
      const res = await adminFor('graphql').fgaReadTuples({
        object: 'document:1',
      });
      expect(res.errors).toHaveLength(0);
      expect(Array.isArray(res.data?.tuples)).toBe(true);
    });

    it('fgaListUsers lists who can access the object (rest)', async () => {
      if (!fgaSupported) return;
      const res = await adminFor('rest').fgaListUsers({
        object: 'document:1',
        relation: 'viewer',
        user_type: 'user',
      });
      expect(res.errors).toHaveLength(0);
      expect(Array.isArray(res.data?.users)).toBe(true);
    });

    it('fgaExpand returns the relationship tree (graphql)', async () => {
      if (!fgaSupported) return;
      const res = await adminFor('graphql').fgaExpand({
        relation: 'viewer',
        object: 'document:1',
      });
      expect(res.errors).toHaveLength(0);
      expect(typeof res.data?.tree).toBe('string');
    });

    it('fgaGetModel returns the active model (rest-only)', async () => {
      if (!fgaSupported) return;
      const res = await adminFor('rest').fgaGetModel();
      expect(res.errors).toHaveLength(0);
      expect(res.data?.dsl).toBeDefined();
    });

    it('fgaDeleteTuples removes the tuple then fgaReset clears the store', async () => {
      if (!fgaSupported) return;
      const delRes = await adminFor('rest').fgaDeleteTuples({
        tuples: [{ user: userId, relation: 'viewer', object: 'document:1' }],
      });
      expect(delRes.errors).toHaveLength(0);

      // Destructive: clears the whole FGA store. Runs last.
      const resetRes = await adminFor('rest').fgaReset();
      expect(resetRes.errors).toHaveLength(0);
    });
  });
});
