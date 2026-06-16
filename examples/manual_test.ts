/**
 * Manual end-to-end smoke test for the Authorizer JS/TS SDK.
 *
 * Exercises the public client (meta/signup/login/profile) and the admin client
 * (users/webhooks/FGA) over the protocol you pick. JS supports `graphql` and
 * `rest` only (no gRPC in the browser/Node SDK).
 *
 * Run (defaults shown) — tsx compiles the TS source on the fly:
 *
 *   AUTHORIZER_URL=http://localhost:8080 \
 *   CLIENT_ID=test-client \
 *   ADMIN_SECRET=admin \
 *   PROTOCOL=graphql \   # graphql | rest
 *   npx tsx examples/manual_test.ts
 */
import { Authorizer, AuthorizerAdmin } from '../src/index';
import type { ApiResponse, Protocol } from '../src/types';

const URL = process.env.AUTHORIZER_URL || 'http://localhost:8080';
const CLIENT_ID = process.env.CLIENT_ID || 'test-client';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin';
const PROTOCOL = (process.env.PROTOCOL || 'graphql') as Protocol; // graphql | rest

const FGA_MODEL = `model
  schema 1.1
type user
type document
  relations
    define viewer: [user]`;

// step runs a call, prints data or error, and never throws so the flow runs.
async function step<T>(label: string, fn: () => Promise<ApiResponse<T>>): Promise<T | undefined> {
  try {
    const res = await fn();
    if (res.errors && res.errors.length) {
      console.log(`✗ ${label.padEnd(22)} error: ${res.errors.map((e) => e.message).join('; ')}`);
      return undefined;
    }
    console.log(`✓ ${label.padEnd(22)}`, JSON.stringify(res.data));
    return res.data;
  } catch (e) {
    console.log(`✗ ${label.padEnd(22)} error: ${(e as Error).message}`);
    return undefined;
  }
}

async function main() {
  console.log(`== Authorizer JS SDK manual test ==\nurl=${URL} protocol=${PROTOCOL}\n`);

  const client = new Authorizer({
    authorizerURL: URL,
    redirectURL: URL,
    clientID: CLIENT_ID,
    protocol: PROTOCOL,
    // Node (non-browser) must send Origin to pass the server CSRF guard.
    extraHeaders: { Origin: URL },
  });

  await step('getMetaData', () => client.getMetaData());

  const email = `js-manual-${Date.now()}@example.com`;
  await step('signup', () =>
    client.signup({ email, password: 'Test@12345', confirm_password: 'Test@12345' }),
  );

  const auth = await step('login', () => client.login({ email, password: 'Test@12345' }));

  if (auth?.access_token) {
    await step('getProfile', () =>
      client.getProfile({ Authorization: `Bearer ${auth.access_token}` }),
    );
  }

  // ---- Admin client (auth via x-authorizer-admin-secret) ----
  console.log('\n-- admin --');
  const admin = new AuthorizerAdmin({
    authorizerURL: URL,
    adminSecret: ADMIN_SECRET,
    protocol: PROTOCOL,
    extraHeaders: { Origin: URL },
  });

  const users = await step('users', () => admin.users());
  if (users) console.log(`   -> ${users.users.length} user(s)`);

  const webhookEndpoint = 'https://example.com/webhook';
  await step('addWebhook', () =>
    admin.addWebhook({ event_name: 'user.login', endpoint: webhookEndpoint, enabled: true }),
  );

  const whs = await step('webhooks', () => admin.webhooks());
  if (whs) {
    console.log(`   -> ${whs.webhooks.length} webhook(s)`);
    // Clean up by endpoint: the server appends a "-<timestamp>" suffix to
    // event_name (not a stable key); endpoint is stored verbatim.
    for (const w of whs.webhooks) {
      if (w.endpoint === webhookEndpoint && w.id) {
        await step('deleteWebhook', () => admin.deleteWebhook({ id: w.id }));
      }
    }
  }

  // ---- FGA admin ----
  console.log('\n-- fga admin --');
  await step('fgaWriteModel', () => admin.fgaWriteModel({ dsl: FGA_MODEL }));
  const fgaObject = `document:${Date.now()}`; // unique so re-runs don't collide
  await step('fgaWriteTuples', () =>
    admin.fgaWriteTuples({ tuples: [{ user: 'user:alice', relation: 'viewer', object: fgaObject }] }),
  );
  const tuples = await step('fgaReadTuples', () => admin.fgaReadTuples({}));
  if (tuples) console.log(`   -> ${tuples.tuples.length} tuple(s)`);

  console.log('\ndone.');
}

main();
