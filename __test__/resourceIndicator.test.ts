/**
 * @jest-environment jsdom
 */
// Unit tests (no docker) for the RFC 8707 resource indicator on the browser
// authorization flow. cross-fetch and the iframe helper are mocked so the exact
// outgoing request can be asserted.
import nodeCrypto from 'node:crypto';
import nodeUtil from 'node:util';
import { Authorizer, ResponseTypes } from '../src';
import { executeIframe } from '../src/utils';

// Only executeIframe is replaced; the rest of utils (PKCE helpers, encoders)
// must keep working or the authorize() path under test never runs.
jest.mock('../src/utils', () => ({
  ...jest.requireActual('../src/utils'),
  executeIframe: jest.fn(),
}));

// jsdom ships neither WebCrypto nor TextEncoder, and authorize() needs both to
// derive the PKCE code_challenge. Without them the flow throws before it ever
// builds a URL, and both tests below would fail for a reason unrelated to what
// they assert.
Object.defineProperty(globalThis, 'crypto', {
  value: nodeCrypto.webcrypto,
  configurable: true,
});
Object.defineProperty(globalThis, 'TextEncoder', {
  value: nodeUtil.TextEncoder,
  configurable: true,
});

// getFetcher() resolves to window.fetch whenever a window exists, so mocking
// cross-fetch would leave the real fetch in place and every assertion on the
// token request would read an empty call list.
const fetchMock = jest.fn();
Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true });
Object.defineProperty(window, 'fetch', { value: fetchMock, configurable: true });

const iframeMock = executeIframe as unknown as jest.Mock;

const MCP_RESOURCE = 'http://localhost:8080/mcp';

function newAuthorizer() {
  return new Authorizer({
    authorizerURL: 'http://localhost:8080',
    redirectURL: 'http://localhost:8080/app',
    clientID: 'test-client-id',
  });
}

function tokenRequestBody(): Record<string, string> {
  const [, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return Object.fromEntries(new URLSearchParams(init.body as string));
}

beforeEach(() => {
  fetchMock.mockReset();
  iframeMock.mockReset();
});

describe('authorize — RFC 8707 resource indicator', () => {
  it('sends resource on BOTH the authorization request and the code exchange', async () => {
    // Both halves matter. The /authorize call is what binds the audience to the
    // authorization code; the exchange must then echo the same value, because
    // the token endpoint rejects a code exchange whose resource does not match
    // the one the authorization request named. Sending it in only one place
    // yields either an unbound token or a rejected exchange.
    iframeMock.mockResolvedValueOnce({ code: 'the-code', state: 'st' });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ access_token: 'at', expires_in: 900 }),
    });

    await newAuthorizer().authorize({
      response_type: ResponseTypes.Code,
      resource: MCP_RESOURCE,
    });

    const authorizeURL = new URL(iframeMock.mock.calls[0][0]);
    expect(authorizeURL.pathname).toBe('/authorize');
    expect(authorizeURL.searchParams.get('resource')).toBe(MCP_RESOURCE);
    // Sanity that the assertion reads the right URL: PKCE is known to be there.
    expect(authorizeURL.searchParams.get('code_challenge_method')).toBe('S256');

    expect(tokenRequestBody().resource).toBe(MCP_RESOURCE);
  });

  it('omits resource entirely when the caller did not ask for one', async () => {
    // The regression guard for every existing integration: an ordinary login
    // must keep the client as its audience. Sending an empty `resource` would
    // be rejected by the server as an invalid target, breaking all of them.
    iframeMock.mockResolvedValueOnce({ code: 'the-code', state: 'st' });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ access_token: 'at', expires_in: 900 }),
    });

    await newAuthorizer().authorize({ response_type: ResponseTypes.Code });

    const authorizeURL = new URL(iframeMock.mock.calls[0][0]);
    expect(authorizeURL.searchParams.has('resource')).toBe(false);
    expect(tokenRequestBody()).not.toHaveProperty('resource');
  });
});
