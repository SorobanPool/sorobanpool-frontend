import { beforeEach, describe, expect, it, vi } from 'vitest';

const start = { reg: vi.fn(), auth: vi.fn() };
vi.mock('@simplewebauthn/browser', () => ({
  browserSupportsWebAuthn: () => true,
  startRegistration: (a: unknown) => start.reg(a),
  startAuthentication: (a: unknown) => start.auth(a),
}));
const calls: { path: string; init: Record<string, unknown> }[] = [];
let passkeyList: { id: string; createdAt: string }[] = [{ id: 'p1', createdAt: '2026-01-01T00:00:00Z' }];
vi.mock('./api', () => ({
  api: async (path: string, init: Record<string, unknown> = {}) => {
    calls.push({ path, init });
    if (path.endsWith('/options')) return { challengeId: 'c1', options: { challenge: 'abc' } };
    if (path === '/auth/passkey' && (init.method ?? 'GET') === 'GET') return passkeyList;
    if (path.startsWith('/auth/passkey/') && init.method === 'DELETE') {
      passkeyList = passkeyList.filter((p) => !path.endsWith(p.id));
      return undefined;
    }
    return { accessToken: 'a', refreshToken: 'r', user: { walletAddress: null } };
  },
}));

import { listPasskeys, passkeyCancelled, passkeysSupported, registerPasskey, removePasskey, signInWithPasskey } from './passkey';

describe('passkey client', () => {
  beforeEach(() => { calls.length = 0; start.reg.mockReset(); start.auth.mockReset(); });

  it('registers: options -> device prompt -> verify with the same challenge id', async () => {
    start.reg.mockResolvedValue({ id: 'cred' });
    await registerPasskey();
    expect(start.reg).toHaveBeenCalledWith({ optionsJSON: { challenge: 'abc' } });
    expect(calls.map((c) => c.path)).toEqual(['/auth/passkey/register/options', '/auth/passkey/register/verify']);
    expect(calls[1]!.init.body).toEqual({ challengeId: 'c1', response: { id: 'cred' } });
  });

  it('signs in without authentication headers and returns the session', async () => {
    start.auth.mockResolvedValue({ id: 'cred' });
    const s = await signInWithPasskey();
    expect(s.accessToken).toBe('a');
    expect(calls.every((c) => c.init.auth === false)).toBe(true);
  });

  it('does not call the server to verify when the person cancels the prompt', async () => {
    start.auth.mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
    await expect(signInWithPasskey()).rejects.toMatchObject({ name: 'NotAllowedError' });
    expect(calls.map((c) => c.path)).toEqual(['/auth/passkey/login/options']);
  });

  it('classifies cancellation and reports support', () => {
    expect(passkeyCancelled({ name: 'NotAllowedError' })).toBe(true);
    expect(passkeyCancelled({ name: 'AbortError' })).toBe(true);
    expect(passkeyCancelled(new Error('network'))).toBe(false);
    expect(passkeysSupported()).toBe(true);
  });
});

describe('passkey management', () => {
  beforeEach(() => { calls.length = 0; passkeyList = [{ id: 'p1', createdAt: '2026-01-01T00:00:00Z' }]; });

  it('lists the signed-in user\'s passkeys', async () => {
    expect(await listPasskeys()).toEqual([{ id: 'p1', createdAt: '2026-01-01T00:00:00Z' }]);
    expect(calls[0]).toMatchObject({ path: '/auth/passkey' });
  });

  it('removes a passkey by id with DELETE', async () => {
    await removePasskey('p1');
    expect(calls[0]).toMatchObject({ path: '/auth/passkey/p1', init: { method: 'DELETE' } });
    expect(await listPasskeys()).toEqual([]);
  });
});
