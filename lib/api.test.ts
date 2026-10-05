import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, session } from './api';

const respond = (status: number, body: string) => vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status })));
afterEach(() => { vi.unstubAllGlobals(); session.clear(); });

describe('api client', () => {
  it('returns null for an empty 200 (the API\'s way of saying "nothing yet"), not an empty object', async () => {
    respond(200, '');
    expect(await api('/suppliers/me')).toBeNull();
  });
  it('parses JSON and throws ApiError with the contract code on failure', async () => {
    respond(200, '{"a":1}');
    expect(await api('/x')).toEqual({ a: 1 });
    respond(422, '{"error":"CONTRACT_ERROR","contractCode":310,"message":"refused"}');
    await expect(api('/y')).rejects.toMatchObject({ status: 422, contractCode: 310, code: 'CONTRACT_ERROR' });
    await expect(api('/y')).rejects.toBeInstanceOf(ApiError);
  });
  it('refreshes once on 401 and retries with the new token', async () => {
    localStorage.setItem('sp.refresh', 'old-refresh-token');
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      calls.push(`${url.split('/v1')[1]} ${(init.headers as Headers).get('authorization') ?? '-'}`);
      if (url.endsWith('/auth/refresh')) return new Response('{"accessToken":"new-access","refreshToken":"new-refresh"}', { status: 200 });
      return (init.headers as Headers).get('authorization') === 'Bearer new-access' ? new Response('{"ok":true}', { status: 200 }) : new Response('{"error":"TOKEN_INVALID"}', { status: 401 });
    }));
    expect(await api('/me')).toEqual({ ok: true });
    expect(calls).toEqual(['/me -', '/auth/refresh -', '/me Bearer new-access']);
    expect(localStorage.getItem('sp.refresh')).toBe('new-refresh');
  });
});
