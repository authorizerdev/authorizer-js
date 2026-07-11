// Fast unit tests (no Docker/testcontainers, no real browser): assert that
// each WebAuthn SDK method sends the right GraphQL operation and unwraps the
// response correctly. The actual browser ceremony glue (src/webauthn.ts) is
// exercised live in a real browser, not here - PublicKeyCredential doesn't
// exist in this jsdom-less Node test environment.
jest.mock('cross-fetch', () => jest.fn());

import crossFetch from 'cross-fetch';
import { Authorizer } from '../lib';

const mockFetch = crossFetch as unknown as jest.Mock;

const jsonResponse = (body: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(body)),
  });

describe('WebAuthn SDK methods', () => {
  const authorizerRef = new Authorizer({
    authorizerURL: 'http://localhost:8080',
    redirectURL: 'http://localhost:8080/app',
  });

  afterEach(() => mockFetch.mockReset());

  it('webauthnRegistrationOptions sends the right operation and unwraps options', async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        data: { webauthn_registration_options: { options: '{"challenge":"abc"}' } },
      }),
    );
    const res = await authorizerRef.webauthnRegistrationOptions();
    expect(res.errors).toHaveLength(0);
    expect(res.data?.options).toBe('{"challenge":"abc"}');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.operationName).toBe('webauthn_registration_options');
  });

  it('webauthnRegistrationVerify sends the credential and returns the message', async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        data: { webauthn_registration_verify: { message: 'Passkey registered successfully.' } },
      }),
    );
    const res = await authorizerRef.webauthnRegistrationVerify({
      name: 'MacBook',
      credential: '{"id":"cred-id"}',
    });
    expect(res.errors).toHaveLength(0);
    expect(res.data?.message).toBe('Passkey registered successfully.');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.variables.data.credential).toBe('{"id":"cred-id"}');
  });

  it('webauthnLoginOptions supports the usernameless (no email) call', async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        data: { webauthn_login_options: { options: '{"challenge":"xyz"}' } },
      }),
    );
    const res = await authorizerRef.webauthnLoginOptions();
    expect(res.errors).toHaveLength(0);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.variables.email).toBeUndefined();
  });

  it('webauthnLoginVerify returns the full auth token shape on success', async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        data: {
          webauthn_login_verify: {
            message: 'Logged in successfully with passkey.',
            access_token: 'token-abc',
            user: { id: 'user-1', email: 'a@b.com' },
          },
        },
      }),
    );
    const res = await authorizerRef.webauthnLoginVerify({
      credential: '{"id":"cred-id"}',
    });
    expect(res.errors).toHaveLength(0);
    expect(res.data?.access_token).toBe('token-abc');
  });

  it('webauthnLoginVerify surfaces the email-verification gate error with its code', async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        errors: [
          {
            message:
              'email is not verified. please verify your email before signing in with a passkey',
            extensions: { code: 'FAILED_PRECONDITION' },
          },
        ],
        data: null,
      }),
    );
    const res = await authorizerRef.webauthnLoginVerify({
      credential: '{"id":"cred-id"}',
    });
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].code).toBe('FAILED_PRECONDITION');
  });

  it('webauthnCredentials lists the caller\'s own passkeys', async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        data: {
          webauthn_credentials: [
            { id: 'cred-1', name: 'MacBook', transports: ['internal'] },
          ],
        },
      }),
    );
    const res = await authorizerRef.webauthnCredentials();
    expect(res.errors).toHaveLength(0);
    expect(res.data).toHaveLength(1);
    expect(res.data?.[0].name).toBe('MacBook');
  });

  it('webauthnDeleteCredential sends the id and returns the message', async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        data: { webauthn_delete_credential: { message: 'Passkey deleted successfully.' } },
      }),
    );
    const res = await authorizerRef.webauthnDeleteCredential('cred-1');
    expect(res.errors).toHaveLength(0);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.variables.id).toBe('cred-1');
  });
});
