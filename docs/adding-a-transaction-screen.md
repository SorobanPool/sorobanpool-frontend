# Adding a screen that signs a transaction

Every screen that moves money, or otherwise asks the user to approve a blockchain action, follows the same path. This guide shows the path, the rules behind it, and a minimal example. Read [`lib/tx.ts`](../lib/tx.ts) and [`lib/verify.ts`](../lib/verify.ts) first; the rules here come from them.

## How signing works

1. The backend prepares the transaction and the authorization entries. The app treats them as untrusted.
2. `runAction` (in `lib/tx.ts`) checks them with `assertSafeAuth` (in `lib/verify.ts`). The check requires that the root call is exactly the action the user tapped, that only USDC transfers go from the user into SorobanPool contracts, and that the total is no more than the amount shown on screen.
3. The device asks the user to confirm. If the device has no fingerprint or face gate, the screen's own confirm dialog (`ask` from `useConfirm`) is used instead.
4. The authorization entries are signed on the device and posted to `/tx/submit` with an idempotency key.

Your screen does not do steps 2-4 itself. It calls `runAction` and nothing else.

## Checklist

Copied from brief section 8.3 and the rules in `lib/tx.ts`. Tick every item before opening a PR.

- [ ] **Show before signing.** The screen shows: units, the most the user pays now, the expected final price, the expected refund, the deadline, the pickup place and time, what happens if the group does not fill or the supplier does not deliver, and the user's dispute rights.
- [ ] **Trust message.** The message "Your money is held safely. The supplier is paid only after the goods arrive. If the group doesn't fill, you get everything back automatically." appears on the screen.
- [ ] **One entry point.** The action goes through `runAction`. Do not call `signAuthEntries` or `/tx/submit` directly.
- [ ] **Pass the maximum.** When the screen shows an amount, pass it as the third argument (`maxTransfer`, in stroops). The guard refuses anything larger.
- [ ] **Explicit confirm.** Pass `ask` from `useConfirm` as the second argument.
- [ ] **Errors.** Show failures with `ErrorExplainer`, which maps contract codes to plain language and gives a "what to do now" line.
- [ ] **No double submit.** Disable the button while the action is busy and after it succeeds.
- [ ] **Refresh.** After success, invalidate the query that holds the screen's data.
- [ ] **Copy.** New text is added to both `messages/en.json` and `messages/pcm.json` with the same keys and placeholders, and passes [`lib/messages.test.ts`](../lib/messages.test.ts) (see [UX writing guide](ux-writing.md)).
- [ ] **Touch targets and layout.** Controls are at least 48 px, and the layout works at 360 px wide.
- [ ] **Bundle.** The Stellar SDK stays out of the initial bundle, as [ADR 0002](decisions/0002-pwa-and-performance-budget.md) requires.
- [ ] **Review.** A change to escrow, settlement, disputes or bond rules needs two maintainer reviews ([CONTRIBUTING.md](../CONTRIBUTING.md)).

## Steps

1. **Add the backend route.** Your screen calls a `prepare` endpoint that returns a `Prepared` object (`txXdr`, `authEntries`, `validUntilLedger`, `contract`, `fn`). Agree the endpoint with the backend first.
2. **Add the copy.** Add every visible string to `messages/en.json` and `messages/pcm.json`. Use the same placeholders in both files.
3. **Write the screen.** Copy the example below and change the names, endpoint and copy.
4. **Show the rules.** Work through the checklist above.
5. **Link it.** If the screen is a new route, add it to the route list in the README.

## Minimal example

This example is a pattern, not a working screen. The endpoint is a placeholder, and the copy keys must exist in both message files.

```tsx
'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useConfirm } from '@/components/ConfirmDialog';
import { ErrorExplainer } from '@/components/feedback/ErrorExplainer';
import { api } from '@/lib/api';
import { runAction, type Prepared } from '@/lib/tx';

export function ExamplePayPanel({ poolId, units, maxNowStroops }: { poolId: string; units: number; maxNowStroops: bigint }) {
  const t = useTranslations('pool');
  const qc = useQueryClient();
  const { ask, dialog } = useConfirm();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      await runAction(
        // Placeholder endpoint: use the one the backend exposes for this action.
        () => api<Prepared>(`/pools/${poolId}/commit/prepare`, { body: { units } }),
        ask,
        maxNowStroops,
      );
      setDone(true);
      await qc.invalidateQueries({ queryKey: ['pool', poolId] });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="pay-h" className="space-y-4">
      <h2 id="pay-h" className="text-lg font-bold">{t('payNow')}</h2>
      <p className="text-xs text-neutral-700">{t('ifFails')}</p>
      <button type="button" disabled={busy || done} onClick={() => void pay()} className="min-h-12 w-full rounded-xl bg-emerald-800 text-lg font-bold text-white disabled:opacity-60">
        {busy ? t('paying') : t('payNow')}
      </button>
      {done && <p role="status">{t('joined')}</p>}
      {error !== null && <ErrorExplainer error={error} onRetry={() => void pay()} />}
      {dialog}
    </section>
  );
}
```

The example uses only strings that already exist in `messages/en.json` (`pool.payNow`, `pool.paying`, `pool.ifFails`, `pool.joined`). A new screen needs its own keys.

## Testing

- Run `pnpm lint`, `pnpm typecheck` and `pnpm test`. The copy tests in `lib/messages.test.ts` check key parity and placeholders.
- Check the screen by hand on a 360 px viewport, with the device confirm and with the fallback confirm.
- Add an end-to-end case to `tests/e2e/` for the happy path and one failure.
