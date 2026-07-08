const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const REFRESH_KEY = 'sp.refresh';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly contractCode?: number,
    public readonly issues?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;

const storage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // private mode or blocked storage: stay signed in for this tab only
  }
};

export const session = {
  set(tokens: { accessToken: string; refreshToken: string }): void {
    accessToken = tokens.accessToken;
    storage()?.setItem(REFRESH_KEY, tokens.refreshToken);
  },
  clear(): void {
    accessToken = null;
    storage()?.removeItem(REFRESH_KEY);
  },
  get hasRefresh(): boolean {
    return !!storage()?.getItem(REFRESH_KEY);
  },
  get access(): string | null {
    return accessToken;
  },
};

async function raw(path: string, init: RequestInit & { auth?: boolean }): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (init.auth !== false && accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  return fetch(`${BASE}/v1${path}`, { ...init, headers });
}

/** Exchanges the stored refresh token (rotating). One refresh at a time; concurrent callers share it. */
async function refresh(): Promise<boolean> {
  const token = storage()?.getItem(REFRESH_KEY);
  if (!token) return false;
  refreshing ??= (async () => {
    try {
      const res = await raw('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: token }), auth: false });
      if (!res.ok) {
        session.clear();
        return false;
      }
      session.set(await res.json());
      return true;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const init = { method: opts.method ?? (opts.body ? 'POST' : 'GET'), body: opts.body === undefined ? undefined : JSON.stringify(opts.body), auth: opts.auth };
  let res = await raw(path, init);
  if (res.status === 401 && opts.auth !== false && (await refresh())) res = await raw(path, init);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok) {
    throw new ApiError(res.status, String(json.error ?? 'HTTP'), String(json.message ?? res.statusText), typeof json.contractCode === 'number' ? json.contractCode : undefined, json.issues as ApiError['issues']);
  }
  return json as T;
}
