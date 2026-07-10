// Fast unit test (no Docker/testcontainers): asserts that a GraphQL error's
// extensions.code survives the SDK's response parsing, so consumers like
// authorizer-react can switch on a stable code (e.g. TOO_MANY_REQUESTS for
// the TOTP lockout) instead of matching message text.
jest.mock('cross-fetch', () => jest.fn());

import crossFetch from 'cross-fetch';
import { Authorizer } from '../lib';

const mockFetch = crossFetch as unknown as jest.Mock;

const jsonResponse = (body: unknown, ok = true) =>
  Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    text: () => Promise.resolve(JSON.stringify(body)),
  });

describe('GraphQL error extensions.code propagation', () => {
  const authorizerRef = new Authorizer({
    authorizerURL: 'http://localhost:8080',
    redirectURL: 'http://localhost:8080/app',
  });

  afterEach(() => mockFetch.mockReset());

  it('surfaces extensions.code on the returned error', async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        errors: [
          {
            message: 'too many failed attempts, please try again later',
            path: ['verify_otp'],
            extensions: { code: 'TOO_MANY_REQUESTS' },
          },
        ],
        data: null,
      }),
    );

    const res = await authorizerRef.graphqlQuery({
      query: 'mutation { verify_otp(params: {}) { message } }',
    });

    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].message).toBe(
      'too many failed attempts, please try again later',
    );
    expect(res.errors[0].code).toBe('TOO_MANY_REQUESTS');
  });

  it('leaves code undefined when the server sends no extensions', async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        errors: [{ message: 'invalid otp', path: ['verify_otp'] }],
        data: null,
      }),
    );

    const res = await authorizerRef.graphqlQuery({
      query: 'mutation { verify_otp(params: {}) { message } }',
    });

    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].message).toBe('invalid otp');
    expect(res.errors[0].code).toBeUndefined();
  });
});
