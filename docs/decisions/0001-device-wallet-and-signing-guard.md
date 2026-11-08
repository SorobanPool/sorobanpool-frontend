# 0001 Device wallet, and the device verifies what it signs

> **Wallet part superseded (November 2026)** by contracts ADR 0006: the default wallet is a passkey smart wallet (`lib/passkey-signer.ts`); nothing secret is stored in the browser and there is no backup to write down. The device key below remains only as a testnet fallback for browsers without passkeys. **The signing guard (`lib/verify.ts`) still applies to every wallet kind.**

**Context.** The wallet decision (passkey smart wallet vs MPC) is open. The backend builds transactions; the user signs only Soroban authorization entries.

**Decision.** Interim: an ed25519 key generated on the device (IndexedDB), gated by a WebAuthn "fingerprint/face" prompt where available. Because the backend builds what is signed, `lib/verify.ts` inspects the *whole* authorization tree first: the root call must be exactly the contract and function the user asked for, and the only nested calls allowed are USDC `transfer`s from the user into SorobanPool contracts (optionally capped at the amount the screen showed). A compromised backend therefore cannot redirect funds. The app refuses to sign if `NEXT_PUBLIC_DEPLOYMENTS` is missing (fail closed).

**Consequences.** The WebAuthn gate is a local confirmation, not a key derivation: malware with page access could read the stored key. This must be replaced by the smart-wallet decision before mainnet. The backup secret is shown to the user and must be kept safe.
