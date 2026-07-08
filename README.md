# sorobanpool-frontend

Next.js PWA for SorobanPool (trader/organizer app, supplier portal, arbiter and admin consoles). **Buy together. Pay on delivery.** Built on Stellar.

```
cp .env.example .env.local
pnpm install && pnpm dev
pnpm lint && pnpm exec tsc --noEmit && pnpm build
```
Languages: `en`, `pcm` (cookie `locale`). Product name lives in `lib/config.ts`. Status: M0 (foundations).
