# UX writing guide: plain language

SorobanPool's users are market traders and organizers with cheap phones, patchy networks and no interest in crypto. Every word on screen should make sense to them on the first read, in English and in Nigerian Pidgin.

The rules come from [brief section 8.3](https://github.com/SorobanPool/sorobanpool-contracts/blob/main/docs/brief.md): "No crypto jargon", "pay", "money held safely until delivery", "refund", and "confirm with your fingerprint/face". Dollar amounts appear only in an info sheet and where the price is fixed.

The test that enforces part of this guide is in [`lib/messages.test.ts`](../lib/messages.test.ts). It fails if a banned term appears in `messages/en.json` or `messages/pcm.json`, unless the key is on the allow-list.

## Principles

1. **Say what happens to the money.** "Your money is held safely until the goods arrive." Not "funds are escrowed on-chain."
2. **Use the verb the user does.** "Pay", "join", "confirm", "refund". Not "submit a transaction" or "sign".
3. **Name the device action plainly.** "Confirm with your fingerprint, face or PIN." Not "authorize the WebAuthn assertion."
4. **Give the next step.** Every error ends with what to do now.
5. **Short sentences, numbers as numerals.** "3 bags", "2 days". Keep sentences under about 20 words.
6. **Pidgin is a language, not a translation of English.** Write it the way a trader would say it. Native speakers review every Pidgin change.

## Terms to avoid

| Avoid | Use instead | Why |
|---|---|---|
| seed phrase, secret phrase, mnemonic | backup, or nothing (passkeys need no secret words) | Users do not know these words, and passkeys need none |
| private key | your passkey on this phone | Keys are not something users hold |
| wallet address | your account, or pickup address for a place | Addresses mean nothing to traders |
| gas, gas fee | fee, or "SorobanPool pays the fee" | Users pay no network fee |
| blockchain, on-chain | held safely, record | Describes the feeling, not the system |
| smart contract | the rules | Users care about the rules, not the code |
| transaction hash, tx | payment, payment reference | Users make payments |
| sign, signature | approve, confirm | The user approves; the device signs |
| escrow | held safely (in the info sheet, you may explain escrow once) | The word is jargon for most traders |
| USDC, stablecoin | dollar amount, or the naira amount | Dollar amounts appear only in an info sheet or where the price is fixed |

## Examples from the product

| Don't | Do |
|---|---|
| Sign the transaction to commit 3 units. | Approve this payment. Your money stays held safely until the goods arrive. |
| Your wallet is protected by a passkey. | Only you can approve payments, with your fingerprint, face or PIN. |
| Gas fees are paid by SorobanPool. | You pay nothing extra. |
| Transaction failed: tx_insufficient_fee. | We could not complete your payment. Try again. If it keeps failing, contact us. |

## Tone

- **English:** plain, warm, direct. "You are in!" is fine. Avoid corporate phrases such as "leverage", "ecosystem" and "seamless".
- **Pidgin:** short, friendly, not childish. Keep the trust message exact: the copy must not promise anything the product does not do.
- Never blame the user. "We could not complete your payment" not "You entered the wrong amount".

## Info sheets

An info sheet may explain the dollar price, escrow or the Stellar network, because the user asked for more detail. Keys for info-sheet copy go on the allow-list in `lib/messages.test.ts` (`ALLOWLIST`). Keep the list short, and add a comment with the reason for each key.

## Adding or changing copy

1. Add the key to `messages/en.json` and `messages/pcm.json` with the same placeholders.
2. Check the words against the table above.
3. Run `pnpm test`. The copy tests fail on a banned term or a missing key.
4. Ask a native Pidgin speaker to review any new Pidgin text.
