/**
 * @jest-environment jsdom
 */

import { executeIframe } from '../src/utils';

describe('executeIframe', () => {
  const authorizerOrigin = 'https://auth.example.com';
  const authorizeUrl = `${authorizerOrigin}/authorize?x=1`;

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('ignores postMessage from a different origin', async () => {
    const p = executeIframe(authorizeUrl, authorizerOrigin, 0.2);
    await new Promise(r => setTimeout(r, 0));
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://evil.example',
        data: { response: { access_token: 'stolen' } },
        source: window as unknown as MessageEventSource,
      }),
    );
    await expect(p).rejects.toThrow('Authorization timeout');
  });

  it('resolves when postMessage origin matches authorizer URL', async () => {
    const p = executeIframe(authorizeUrl, authorizerOrigin, 0.05);
    await new Promise(r => setTimeout(r, 0));
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: authorizerOrigin,
        data: { response: { code: 'auth-code' } },
        source: null,
      }),
    );
    await expect(p).resolves.toEqual({ code: 'auth-code' });
  });
});
