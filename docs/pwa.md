# PWA caching strategy

The service worker is [`public/sw.js`](../public/sw.js). The rules and their reasons are in [ADR 0002](decisions/0002-pwa-and-performance-budget.md). If you change `sw.js`, update the table and the diagram in the same PR.

Line numbers below refer to `public/sw.js` on `main`.

## Route table

| Request | Strategy | Cache | Code | Cleared when |
|---|---|---|---|---|
| Any non-GET request (POST, PUT, ...) | Not handled by the worker; goes straight to the network | none | line 41 | never cached |
| Same-origin `/_next/static/*` and `/icons/*` | Cache first. On a miss, fetch and store the response if it is OK | `static-v1` | lines 43-46 | a `VERSION` bump removes it on `activate` (line 19) |
| Page navigations | Network first. On failure: cached page, then `/offline` | `pages-v1` (`/offline` is precached at install, line 13) | lines 47-50 | a `VERSION` bump |
| GET `/v1/pools...`, `/v1/p...`, `/v1/offers...` (regex on line 10), except paths containing `/sharecard` | Network first. On failure: last cached response | `api-v1` | lines 51-53 | sign-out posts `CLEAR_API` (lines 9 and 24-26); a `VERSION` bump |
| Everything else: `/v1/tx`, `/v1/auth`, `/v1/me`, wallets, uploads, evidence, admin | Not handled by the worker; goes to the network | none | line 51 does not match | never cached |

Network-first responses are stored only when `res.ok` is true (`networkFirst`, lines 28-37). The fallback order on a network failure is: the cached copy of this request, then (for navigations only) `/offline`, then a network error.

## Request flow

```mermaid
flowchart TD
    R["fetch event"] --> M{"GET request?<br/>(line 41)"}
    M -- no --> N1["Network only, not stored"]
    M -- yes --> S{"Same origin and /_next/static or /icons/?<br/>(line 43)"}
    S -- yes --> SC["static-v1: cache first,<br/>store on miss if OK"]
    S -- no --> NV{"Navigation?<br/>(line 47)"}
    NV -- yes --> PG["pages-v1: network first<br/>fallback: cached page, then /offline"]
    NV -- no --> AP{"Matches CACHEABLE_API<br/>and not /sharecard?<br/>(line 51)"}
    AP -- yes --> AC["api-v1: network first<br/>fallback: last cached response"]
    AP -- no --> N2["Network only, not stored"]
```

## Sign-out and versions

- On sign-out the app must post the string `CLEAR_API` to the worker. The worker then deletes `api-v1` (lines 9 and 24-26), because cached pool views contain the signed-in user's own commitment.
- `VERSION` (line 3) is part of every cache name. Bumping it makes the next `activate` delete the old caches, because any cache name not in `KEEP` (line 7) is removed.

## Testing in Chrome DevTools

Use a production build (`pnpm build && pnpm start`). Register and check the worker from a clean profile.

1. **Application > Service Workers.** Confirm that `sw.js` is activated and running. Tick **Update on reload** while you work.
2. **Application > Cache Storage.** Visit a public pool page. Expect `static-v1` and `pages-v1` to exist, and `api-v1` to hold the `/v1/pools` or `/v1/p` response. Expect `pages-v1` to contain `/offline`.
3. **Offline shell.** Tick **Network > Offline** and reload the pool page. It should render from cache. Open a page you have never visited while offline. It should show `/offline`.
4. **Never cached.** Submit an action, then check Cache Storage. No `/v1/tx`, `/v1/auth`, `/v1/me`, upload or evidence response should appear in any cache. A `/sharecard` URL should not appear in `api-v1`.
5. **Sign-out.** Sign out, then check that `api-v1` is gone or empty.
6. **Version bump.** Change `VERSION`, reload, and confirm that the old `*-v1` caches are removed after the new worker activates.

## Review checklist for changes to `sw.js`

- [ ] The table above matches the code, line numbers included
- [ ] The diagram matches the table
- [ ] Nothing that carries credentials or moves money is cached
- [ ] `CLEAR_API` still clears everything a signed-in user can see
- [ ] The Lighthouse JavaScript budget in [ADR 0002](decisions/0002-pwa-and-performance-budget.md) is not affected by the worker
