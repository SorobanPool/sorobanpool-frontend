/* SorobanPool service worker: offline shell and last-known pool states.
 * Never caches anything that carries credentials or moves money: auth, wallets, tx, /me, uploads, evidence. */
const VERSION = 'v1';
const STATIC = `static-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const API = `api-${VERSION}`;
const KEEP = [STATIC, PAGES, API];
// Read-only data that is safe to show stale. Pool views include the signed-in user's own commitment, so this cache
// is wiped on sign-out (see CLEAR_API below).
const CACHEABLE_API = /^\/v1\/(pools|p|offers)(\/|$|\?)/;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(PAGES).then((c) => c.add('/offline')));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (!KEEP.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'CLEAR_API') e.waitUntil(caches.delete(API));
});

async function networkFirst(req, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req)) ?? (fallbackUrl ? await (await caches.open(PAGES)).match(fallbackUrl) : undefined) ?? Response.error();
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin && (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/'))) {
    e.respondWith(caches.open(STATIC).then(async (c) => (await c.match(req)) ?? fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; })));
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(networkFirst(req, PAGES, '/offline'));
    return;
  }
  if (CACHEABLE_API.test(url.pathname) && !url.pathname.includes('/sharecard')) {
    e.respondWith(networkFirst(req, API));
  }
});
