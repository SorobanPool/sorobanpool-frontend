# sorobanpool-frontend

Next.js PWA for SorobanPool (trader/organizer app, supplier portal, arbiter and admin consoles). **Buy together. Pay on delivery.** Built on Stellar.

```
cp .env.example .env.local
pnpm install && pnpm dev
pnpm lint && pnpm exec tsc --noEmit && pnpm build
```
Languages: `en`, `pcm` (cookie `locale`). Product name lives in `lib/config.ts`. Status: feature-complete for the testnet build — trader/organizer app, supplier portal, disputes, arbiter and admin consoles, naira deposit — verified end to end on Stellar testnet. Not production-ready.

The product and architecture brief (source of truth): [sorobanpool-contracts/docs/brief.md](https://github.com/SorobanPool/sorobanpool-contracts/blob/main/docs/brief.md). Sibling repos: [contracts](https://github.com/SorobanPool/sorobanpool-contracts), [backend](https://github.com/SorobanPool/sorobanpool-backend), [frontend](https://github.com/SorobanPool/sorobanpool-frontend).

## Verify
```
pnpm lint && pnpm typecheck && pnpm test           # 75 tests: components, i18n parity, pricing parity vs the contracts, signing guard, passkey and live-update clients, axe
# E2E needs a funded testnet key and the backend dev server (sorobanpool-backend: pnpm dev:server):
NEXT_PUBLIC_API_URL=http://localhost:3100 NEXT_PUBLIC_DEPLOYMENTS="$(jq -c '{usdc, contracts: (.contracts|map_values(.id))}' ../sorobanpool-contracts/deployments/testnet.json)" pnpm build
SPONSOR_SECRET=S... pnpm test:e2e                  # onboarding, full group-buy lifecycle, supplier/disputes (m4), admin/naira (m5), passkeys, WCAG 2.1 AA (en+pcm+admin), offline
```
Measured (Lighthouse mobile, public pool page): perf 0.98, LCP 1.7 s, 162 KB JS.

## Notes
- The pool page updates live from the backend's SSE stream (`lib/pool-stream.ts`) and falls back to polling every 15 s.
- Passkeys: add one in Settings, then sign in with it from the onboarding screen (needs a browser with WebAuthn; the button only appears where supported). This is sign-in only, not a passkey wallet.
- The app refuses to sign anything unless `NEXT_PUBLIC_DEPLOYMENTS` is baked in at build time (it cannot verify what it is signing otherwise). A build without it will load but every money action will fail by design.

## Not done yet
Passkey smart wallet (ADR 0001), Pidgin copy review by native speakers, Lighthouse in CI, translations beyond EN/PCM, a real naira provider (the app talks to the backend's mock anchor), native-device testing (Playwright mobile emulation only).
