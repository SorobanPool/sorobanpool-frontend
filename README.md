# sorobanpool-frontend

Next.js PWA for SorobanPool (trader/organizer app, supplier portal, arbiter and admin consoles). **Buy together. Pay on delivery.** Built on Stellar.

```
cp .env.example .env.local
pnpm install && pnpm dev
pnpm lint && pnpm exec tsc --noEmit && pnpm build
```
Languages: `en`, `pcm` (cookie `locale`). Product name lives in `lib/config.ts`. Status: M3 (trader and organizer PWA), verified end to end on Stellar testnet.

The product and architecture brief (source of truth): [sorobanpool-contracts/docs/brief.md](https://github.com/SorobanPool/sorobanpool-contracts/blob/main/docs/brief.md). Sibling repos: [contracts](https://github.com/SorobanPool/sorobanpool-contracts), [backend](https://github.com/SorobanPool/sorobanpool-backend), [frontend](https://github.com/SorobanPool/sorobanpool-frontend).

## Verify
```
pnpm lint && pnpm typecheck && pnpm test           # 47 tests: components, i18n parity, pricing parity vs the contracts, signing guard, axe
# E2E needs a funded testnet key and the backend dev server (sorobanpool-backend: pnpm dev:server):
NEXT_PUBLIC_API_URL=http://localhost:3100 NEXT_PUBLIC_DEPLOYMENTS="$(jq -c '{usdc, contracts: (.contracts|map_values(.id))}' ../sorobanpool-contracts/deployments/testnet.json)" pnpm build
SPONSOR_SECRET=S... pnpm test:e2e                  # onboarding, full group-buy lifecycle, WCAG 2.1 AA (en+pcm), offline
```
Measured (Lighthouse mobile, public pool page): perf 0.98, LCP 1.7 s, 162 KB JS.

## Not done yet
Supplier portal and dispute screens (M4), naira rails and admin console (M5), passkey smart wallet (ADR 0001), Pidgin copy review by native speakers, Lighthouse in CI, translations beyond EN/PCM.
