// Unit tests (no docker) for the SAML IdP admin surface (Authorizer acting as
// Identity Provider for downstream SPs): create/update/delete/get/list SPs,
// signing-key rotation/retirement/listing, and SP-metadata import. Same
// mocked-cross-fetch pattern as tokenGrants.test.ts's admin section.
import crossFetch from 'cross-fetch';
import { AuthorizerAdmin } from '../src';

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

function lastRequest(): { url: string; body: any } {
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return { url, body: JSON.parse(init.body as string) };
}

beforeEach(() => fetchMock.mockReset());

const adminConfig = {
  authorizerURL: 'http://localhost:8080',
  adminSecret: 'secret',
};

describe('AuthorizerAdmin SAML IdP methods', () => {
  it('createSAMLServiceProvider posts the mutation over graphql', async () => {
    const admin = new AuthorizerAdmin(adminConfig);
    mockJsonResponse({
      data: {
        _create_saml_service_provider: {
          id: 'sp1',
          org_id: 'o1',
          name: 'acme-sp',
          entity_id: 'urn:acme:sp',
          acs_url: 'https://acme.example.com/acs',
          sp_cert_pem: null,
          name_id_format: null,
          mapped_attributes: null,
          allow_idp_initiated: false,
          is_active: true,
          created_at: 1,
          updated_at: 1,
        },
      },
    });
    const res = await admin.createSAMLServiceProvider({
      org_id: 'o1',
      name: 'acme-sp',
      entity_id: 'urn:acme:sp',
      acs_url: 'https://acme.example.com/acs',
    });
    expect(res.errors).toHaveLength(0);
    expect(res.data?.id).toBe('sp1');

    const { url, body } = lastRequest();
    expect(url).toBe('http://localhost:8080/graphql');
    expect(body.operationName).toBe('_create_saml_service_provider');
    expect(body.variables).toEqual({
      params: {
        org_id: 'o1',
        name: 'acme-sp',
        entity_id: 'urn:acme:sp',
        acs_url: 'https://acme.example.com/acs',
      },
    });
  });

  it('samlServiceProvider unwraps the proto-gateway wrapper over rest', async () => {
    const admin = new AuthorizerAdmin({ ...adminConfig, protocol: 'rest' });
    mockJsonResponse({
      saml_service_provider: { id: 'sp1', name: 'acme-sp' },
    });
    const res = await admin.samlServiceProvider({ id: 'sp1' });
    expect(res.errors).toHaveLength(0);
    expect(res.data).toEqual({ id: 'sp1', name: 'acme-sp' });
    expect(lastRequest().url).toBe(
      'http://localhost:8080/v1/admin/saml_service_provider',
    );
  });

  it('listSAMLServiceProviders returns the paginated list over rest', async () => {
    const admin = new AuthorizerAdmin({ ...adminConfig, protocol: 'rest' });
    mockJsonResponse({
      saml_service_providers: [{ id: 'sp1' }],
      pagination: { limit: '10', page: '1', offset: '0', total: '1' },
    });
    const res = await admin.listSAMLServiceProviders({ org_id: 'o1' });
    expect(res.errors).toHaveLength(0);
    expect(res.data?.saml_service_providers).toHaveLength(1);
    // int64 strings from the proto gateway are coerced to numbers
    expect(res.data?.pagination.total).toBe(1);
    expect(lastRequest().body).toEqual({ org_id: 'o1' });
  });

  it('deleteSAMLServiceProvider posts the mutation and returns a message', async () => {
    const admin = new AuthorizerAdmin(adminConfig);
    mockJsonResponse({
      data: { _delete_saml_service_provider: { message: 'deleted' } },
    });
    const res = await admin.deleteSAMLServiceProvider({ id: 'sp1' });
    expect(res.errors).toHaveLength(0);
    expect(res.data?.message).toBe('deleted');
    expect(lastRequest().body.operationName).toBe(
      '_delete_saml_service_provider',
    );
  });

  it('rotateSAMLIDPCert unwraps saml_idp_key over rest', async () => {
    const admin = new AuthorizerAdmin({ ...adminConfig, protocol: 'rest' });
    mockJsonResponse({
      saml_idp_key: { id: 'k2', org_id: 'o1', status: 'current' },
    });
    const res = await admin.rotateSAMLIDPCert({ org_id: 'o1' });
    expect(res.errors).toHaveLength(0);
    expect(res.data?.status).toBe('current');
    expect(lastRequest().url).toBe(
      'http://localhost:8080/v1/admin/rotate_saml_idp_cert',
    );
  });

  it('retireSAMLIDPKey posts the mutation over graphql', async () => {
    const admin = new AuthorizerAdmin(adminConfig);
    mockJsonResponse({
      data: { _retire_saml_idp_key: { message: 'retired' } },
    });
    const res = await admin.retireSAMLIDPKey({ id: 'k1' });
    expect(res.errors).toHaveLength(0);
    expect(res.data?.message).toBe('retired');
  });

  it('listSAMLIDPKeys unwraps the bare array over rest', async () => {
    const admin = new AuthorizerAdmin({ ...adminConfig, protocol: 'rest' });
    mockJsonResponse({
      saml_idp_keys: [
        { id: 'k1', status: 'current' },
        { id: 'k2', status: 'retired' },
      ],
    });
    const res = await admin.listSAMLIDPKeys({ org_id: 'o1' });
    expect(res.errors).toHaveLength(0);
    expect(res.data).toHaveLength(2);
    expect(res.data?.[0].status).toBe('current');
  });

  it('importSAMLSPMetadata unwraps the result over rest', async () => {
    const admin = new AuthorizerAdmin({ ...adminConfig, protocol: 'rest' });
    mockJsonResponse({
      result: {
        entity_id: 'urn:acme:sp',
        acs_url: 'https://acme.example.com/acs',
        certificate: null,
      },
    });
    const res = await admin.importSAMLSPMetadata({
      metadata_xml: '<EntityDescriptor/>',
    });
    expect(res.errors).toHaveLength(0);
    expect(res.data?.entity_id).toBe('urn:acme:sp');
    expect(lastRequest().body).toEqual({
      metadata_xml: '<EntityDescriptor/>',
    });
  });
});
