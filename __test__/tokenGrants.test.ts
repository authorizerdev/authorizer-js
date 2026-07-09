// Unit tests (no docker) for the machine-agent-identity surface: the
// client_credentials / RFC 8693 token-exchange grants on getToken, and the
// new admin methods' request construction. cross-fetch is mocked so we can
// assert the exact request bodies sent to the server.
import crossFetch from 'cross-fetch';
import {
  Authorizer,
  AuthorizerAdmin,
  GRANT_TYPE_CLIENT_CREDENTIALS,
  GRANT_TYPE_TOKEN_EXCHANGE,
  CLIENT_ASSERTION_TYPE_JWT_BEARER,
  TOKEN_TYPE_ACCESS_TOKEN,
} from '../src';

jest.mock('cross-fetch', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const fetchMock = crossFetch as unknown as jest.Mock;

function mockJsonResponse(body: unknown, ok = true, status = 200) {
  fetchMock.mockResolvedValueOnce({
    ok,
    status,
    text: async () => JSON.stringify(body),
  });
}

function lastRequest(): { url: string; init: RequestInit; body: any } {
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return { url, init, body: JSON.parse(init.body as string) };
}

beforeEach(() => fetchMock.mockReset());

describe('getToken machine grants', () => {
  const authorizer = new Authorizer({
    authorizerURL: 'http://localhost:8080',
    redirectURL: 'http://localhost:8080/app',
    clientID: 'test-client-id',
  });

  it('sends client_secret + scope for client_credentials and omits unset params', async () => {
    mockJsonResponse({
      access_token: 'at',
      token_type: 'Bearer',
      expires_in: 900,
      scope: 'read:users',
    });
    const res = await authorizer.getToken({
      grant_type: GRANT_TYPE_CLIENT_CREDENTIALS,
      client_secret: 'sa-secret',
      scope: 'read:users',
    });
    expect(res.errors).toHaveLength(0);
    expect(res.data?.access_token).toBe('at');

    const { url, body } = lastRequest();
    expect(url).toBe('http://localhost:8080/oauth/token');
    expect(body).toEqual({
      client_id: 'test-client-id',
      grant_type: GRANT_TYPE_CLIENT_CREDENTIALS,
      client_secret: 'sa-secret',
      scope: 'read:users',
    });
    // legacy params must not be sent on machine grants
    expect(body).not.toHaveProperty('code');
    expect(body).not.toHaveProperty('code_verifier');
    expect(body).not.toHaveProperty('refresh_token');
  });

  it('sends client_assertion for secretless client_credentials', async () => {
    mockJsonResponse({ access_token: 'at', expires_in: 900 });
    await authorizer.getToken({
      grant_type: GRANT_TYPE_CLIENT_CREDENTIALS,
      client_assertion: 'k8s-sa-jwt',
      client_assertion_type: CLIENT_ASSERTION_TYPE_JWT_BEARER,
    });

    const { body } = lastRequest();
    expect(body.client_assertion).toBe('k8s-sa-jwt');
    expect(body.client_assertion_type).toBe(CLIENT_ASSERTION_TYPE_JWT_BEARER);
    expect(body).not.toHaveProperty('client_secret');
  });

  it('sends the RFC 8693 params for token exchange', async () => {
    mockJsonResponse({
      access_token: 'delegated',
      issued_token_type: TOKEN_TYPE_ACCESS_TOKEN,
      token_type: 'Bearer',
      expires_in: 300,
      scope: 'read:docs',
    });
    const res = await authorizer.getToken({
      grant_type: GRANT_TYPE_TOKEN_EXCHANGE,
      client_secret: 'agent-secret',
      subject_token: 'user-at',
      subject_token_type: TOKEN_TYPE_ACCESS_TOKEN,
      actor_token: 'agent-at',
      actor_token_type: TOKEN_TYPE_ACCESS_TOKEN,
      resource: 'https://api.example.com',
      scope: 'read:docs',
    });
    expect(res.errors).toHaveLength(0);
    expect(res.data?.issued_token_type).toBe(TOKEN_TYPE_ACCESS_TOKEN);

    const { body } = lastRequest();
    expect(body).toEqual({
      client_id: 'test-client-id',
      grant_type: GRANT_TYPE_TOKEN_EXCHANGE,
      client_secret: 'agent-secret',
      subject_token: 'user-at',
      subject_token_type: TOKEN_TYPE_ACCESS_TOKEN,
      actor_token: 'agent-at',
      actor_token_type: TOKEN_TYPE_ACCESS_TOKEN,
      resource: 'https://api.example.com',
      scope: 'read:docs',
    });
  });

  it('rejects token exchange without subject_token before any request', async () => {
    const res = await authorizer.getToken({
      grant_type: GRANT_TYPE_TOKEN_EXCHANGE,
      client_secret: 'agent-secret',
    });
    expect(res.errors[0].message).toBe('Invalid subject_token');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still sends refresh_token grant unchanged (regression)', async () => {
    mockJsonResponse({ access_token: 'at', expires_in: 900, id_token: 'idt' });
    await authorizer.getToken({
      grant_type: 'refresh_token',
      refresh_token: 'rt',
    });
    const { body } = lastRequest();
    expect(body).toEqual({
      client_id: 'test-client-id',
      grant_type: 'refresh_token',
      refresh_token: 'rt',
    });
  });

  it('surfaces the OAuth error_description on failure', async () => {
    mockJsonResponse(
      {
        error: 'invalid_client',
        error_description: 'Client authentication failed',
      },
      false,
      401,
    );
    const res = await authorizer.getToken({
      grant_type: GRANT_TYPE_CLIENT_CREDENTIALS,
      client_secret: 'bad',
    });
    expect(res.errors[0].message).toBe('Client authentication failed');
  });
});

describe('AuthorizerAdmin machine-agent-identity methods', () => {
  const adminConfig = {
    authorizerURL: 'http://localhost:8080',
    adminSecret: 'secret',
  };

  it('createClient posts the _create_client mutation over graphql', async () => {
    const admin = new AuthorizerAdmin(adminConfig);
    mockJsonResponse({
      data: {
        _create_client: {
          client: { id: 'c1', name: 'svc', allowed_scopes: ['read:users'] },
          client_secret: 'once',
        },
      },
    });
    const res = await admin.createClient({
      name: 'svc',
      allowed_scopes: ['read:users'],
    });
    expect(res.errors).toHaveLength(0);
    expect(res.data?.client_secret).toBe('once');

    const { url, init, body } = lastRequest();
    expect(url).toBe('http://localhost:8080/graphql');
    expect(
      (init.headers as Record<string, string>)['x-authorizer-admin-secret'],
    ).toBe('secret');
    expect(body.operationName).toBe('_create_client');
    expect(body.variables).toEqual({
      params: { name: 'svc', allowed_scopes: ['read:users'] },
    });
  });

  it('trustedIssuers hits the mapped REST route over rest protocol', async () => {
    const admin = new AuthorizerAdmin({ ...adminConfig, protocol: 'rest' });
    mockJsonResponse({
      trusted_issuers: [],
      pagination: { limit: '10', page: '1', offset: '0', total: '0' },
    });
    const res = await admin.trustedIssuers({
      service_account_id: 'sa1',
    });
    expect(res.errors).toHaveLength(0);
    // int64 strings from the proto gateway are coerced to numbers
    expect(res.data?.pagination.total).toBe(0);

    const { url, body } = lastRequest();
    expect(url).toBe('http://localhost:8080/v1/admin/trusted_issuers');
    expect(body).toEqual({ service_account_id: 'sa1' });
  });

  it('client unwraps the proto-gateway wrapper over rest', async () => {
    const admin = new AuthorizerAdmin({ ...adminConfig, protocol: 'rest' });
    mockJsonResponse({ client: { id: 'c1', name: 'svc' } });
    const res = await admin.client({ id: 'c1' });
    expect(res.data).toEqual({ id: 'c1', name: 'svc' });
    expect(lastRequest().url).toBe('http://localhost:8080/v1/admin/client');
  });

  it('graphql-only org methods refuse the rest protocol with a clear error', async () => {
    const admin = new AuthorizerAdmin({ ...adminConfig, protocol: 'rest' });
    const res = await admin.createOrganization({ name: 'acme' });
    expect(res.errors[0].message).toBe(
      'CreateOrganization is not available over rest; supported: graphql',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('createScimEndpoint posts the _create_scim_endpoint mutation', async () => {
    const admin = new AuthorizerAdmin(adminConfig);
    mockJsonResponse({
      data: {
        _create_scim_endpoint: {
          scim_endpoint: { id: 's1', org_id: 'o1', enabled: true },
          token: 'bearer-once',
        },
      },
    });
    const res = await admin.createScimEndpoint({ org_id: 'o1' });
    expect(res.data?.token).toBe('bearer-once');
    const { body } = lastRequest();
    expect(body.operationName).toBe('_create_scim_endpoint');
    expect(body.variables).toEqual({ params: { org_id: 'o1' } });
  });
});
