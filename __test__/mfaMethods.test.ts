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

describe('MFA setup/skip/lock SDK methods', () => {
  const authorizerRef = new Authorizer({
    authorizerURL: 'http://localhost:8080',
    redirectURL: 'http://localhost:8080/app',
  });

  afterEach(() => mockFetch.mockReset());

  it('skipMfaSetup sends email/phone_number/state and returns the issued token', async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        data: {
          skip_mfa_setup: {
            message: 'MFA setup skipped',
            access_token: 'tok-123',
            user: { id: 'u1' },
          },
        },
      }),
    );
    const res = await authorizerRef.skipMfaSetup({
      email: 'user@example.com',
      state: 'oidc-state',
    });
    expect(res.errors).toHaveLength(0);
    expect(res.data?.access_token).toBe('tok-123');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.operationName).toBe('skip_mfa_setup');
    expect(body.variables.data.email).toBe('user@example.com');
    expect(body.variables.data.state).toBe('oidc-state');
  });

  it('lockMfa sends email/phone_number and returns the message', async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        data: {
          lock_mfa: {
            message:
              'Your account is locked. Contact your administrator to regain access.',
          },
        },
      }),
    );
    const res = await authorizerRef.lockMfa({ email: 'user@example.com' });
    expect(res.errors).toHaveLength(0);
    expect(res.data?.message).toMatch(/locked/i);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.operationName).toBe('lock_mfa');
    expect(body.variables.data.email).toBe('user@example.com');
  });

  it('emailOtpMfaSetup works with no params (bearer-token mode)', async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        data: {
          email_otp_mfa_setup: {
            message: 'Check your email for the verification code',
          },
        },
      }),
    );
    const res = await authorizerRef.emailOtpMfaSetup();
    expect(res.errors).toHaveLength(0);
    expect(res.data?.message).toMatch(/email/i);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.operationName).toBe('email_otp_mfa_setup');
  });

  it('emailOtpMfaSetup sends email when provided (cookie mode)', async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        data: {
          email_otp_mfa_setup: {
            message: 'Check your email for the verification code',
          },
        },
      }),
    );
    await authorizerRef.emailOtpMfaSetup({ email: 'user@example.com' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.variables.data.email).toBe('user@example.com');
  });

  it('smsOtpMfaSetup sends phone_number and returns the message', async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        data: {
          sms_otp_mfa_setup: {
            message: 'Check your phone for the verification code',
          },
        },
      }),
    );
    const res = await authorizerRef.smsOtpMfaSetup({
      phone_number: '+15551234567',
    });
    expect(res.errors).toHaveLength(0);
    expect(res.data?.message).toMatch(/phone/i);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.operationName).toBe('sms_otp_mfa_setup');
    expect(body.variables.data.phone_number).toBe('+15551234567');
  });

  it('totpMfaSetup works with no params (bearer-token mode) and returns the enrollment payload', async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        data: {
          totp_mfa_setup: {
            message: 'Proceed to totp verification screen',
            should_show_totp_screen: true,
            authenticator_scanner_image: 'base64-image-data',
            authenticator_secret: 'JBSWY3DPEHPK3PXP',
            authenticator_recovery_codes: ['code-1', 'code-2'],
          },
        },
      }),
    );
    const res = await authorizerRef.totpMfaSetup();
    expect(res.errors).toHaveLength(0);
    expect(res.data?.authenticator_secret).toBe('JBSWY3DPEHPK3PXP');
    expect(res.data?.authenticator_recovery_codes).toEqual([
      'code-1',
      'code-2',
    ]);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.operationName).toBe('totp_mfa_setup');
  });

  it('totpMfaSetup sends email when provided (cookie mode)', async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        data: {
          totp_mfa_setup: {
            message: 'Proceed to totp verification screen',
            should_show_totp_screen: true,
            authenticator_scanner_image: 'base64-image-data',
            authenticator_secret: 'JBSWY3DPEHPK3PXP',
            authenticator_recovery_codes: ['code-1'],
          },
        },
      }),
    );
    await authorizerRef.totpMfaSetup({ email: 'user@example.com' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.variables.data.email).toBe('user@example.com');
  });
});
