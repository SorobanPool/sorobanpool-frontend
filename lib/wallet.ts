import { del, get, set } from 'idb-keyval';

/**
 * The user's wallet on this device. Two kinds:
 * - `passkey` (default; contracts ADR 0006): a smart-wallet contract controlled by the person's passkey. Nothing
 *   secret is stored here, only the wallet's address; every signature is a fingerprint/face/PIN prompt.
 * - `device` (testnet fallback for browsers without passkeys; frontend ADR 0001): an ed25519 key kept in
 *   IndexedDB, with a backup secret. Never offered on mainnet.
 * The Stellar SDK is large, so it is loaded only when something is actually signed.
 */
const KEY = 'sp.wallet.v1';

interface DeviceStored {
  kind?: 'device'; // absent on wallets stored before passkey wallets existed
  secret: string;
  publicKey: string;
  /** WebAuthn credential used as a "confirm with fingerprint/face" gate before signing (not a key derivation). */
  credentialId?: string;
}
interface PasskeyStored {
  kind: 'passkey';
  address: string;
}
type Stored = DeviceStored | PasskeyStored;

export type WalletKind = 'passkey' | 'device';
export interface WalletInfo {
  /** The wallet's Stellar address: a C... contract for passkey wallets, a G... account for device wallets. */
  publicKey: string;
  kind: WalletKind;
}

const isPasskey = (s: Stored): s is PasskeyStored => s.kind === 'passkey';
const info = (s: Stored): WalletInfo => (isPasskey(s) ? { publicKey: s.address, kind: 'passkey' } : { publicKey: s.publicKey, kind: 'device' });

const sdk = () => import('@stellar/stellar-sdk');

let memory: Stored | null = null; // fallback when IndexedDB is unavailable (private mode): lasts for this tab

async function read(): Promise<Stored | null> {
  try {
    return (await get<Stored>(KEY)) ?? memory;
  } catch {
    return memory;
  }
}

async function write(s: Stored): Promise<void> {
  memory = s;
  try {
    await set(KEY, s);
  } catch {
    /* kept in memory only */
  }
}

export async function loadWallet(): Promise<WalletInfo | null> {
  const s = await read();
  return s ? info(s) : null;
}

/**
 * Remembers a passkey wallet on this device. Safe to call for any passkey wallet the account owns: signing needs
 * the person's passkey, not anything stored here, so a synced passkey works on a new phone straight away.
 */
export async function adoptPasskeyWallet(address: string): Promise<WalletInfo> {
  if (!/^C[A-Z2-7]{55}$/.test(address)) throw new Error('NOT_A_PASSKEY_WALLET');
  await write({ kind: 'passkey', address });
  return { publicKey: address, kind: 'passkey' };
}

/** Testnet fallback: creates a device-key wallet (see the module comment). */
export async function createWallet(): Promise<{ publicKey: string }> {
  const { Keypair } = await sdk();
  const kp = Keypair.random();
  const credentialId = await registerDeviceCredential(kp.publicKey());
  await write({ secret: kp.secret(), publicKey: kp.publicKey(), credentialId });
  return { publicKey: kp.publicKey() };
}

export async function importWallet(secret: string): Promise<{ publicKey: string }> {
  const { Keypair } = await sdk();
  const kp = Keypair.fromSecret(secret.trim());
  const credentialId = await registerDeviceCredential(kp.publicKey());
  await write({ secret: kp.secret(), publicKey: kp.publicKey(), credentialId });
  return { publicKey: kp.publicKey() };
}

export async function clearWallet(): Promise<void> {
  memory = null;
  try {
    await del(KEY);
  } catch {
    /* nothing stored */
  }
}

const b64 = (bytes: ArrayBuffer | Uint8Array): string => {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  u.forEach((c) => (s += String.fromCharCode(c)));
  return btoa(s);
};

async function registerDeviceCredential(label: string): Promise<string | undefined> {
  try {
    if (typeof navigator === 'undefined' || !navigator.credentials?.create) return undefined;
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'SorobanPool' },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: label.slice(0, 12), displayName: 'My wallet' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { userVerification: 'required', authenticatorAttachment: 'platform' },
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
    return cred ? b64(cred.rawId) : undefined;
  } catch {
    return undefined; // no authenticator, or the user declined: signing falls back to an explicit confirm button
  }
}

export type DeviceCheck = 'verified' | 'unavailable' | 'denied';

/** Fingerprint/face/PIN prompt before signing. "unavailable" means this device has none; the UI then asks for a plain confirm. */
export async function confirmWithDevice(): Promise<DeviceCheck> {
  const s = await read();
  // A passkey wallet's signature IS the fingerprint/face prompt (made while signing), so there is no extra gate.
  if (s && isPasskey(s)) return 'verified';
  if (!s?.credentialId || typeof navigator === 'undefined' || !navigator.credentials?.get) return 'unavailable';
  try {
    const id = Uint8Array.from(atob(s.credentialId), (c) => c.charCodeAt(0));
    const got = await navigator.credentials.get({
      publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: 'public-key', id }], userVerification: 'required', timeout: 60_000 },
    });
    return got ? 'verified' : 'denied';
  } catch {
    return 'denied';
  }
}

async function keypair() {
  const s = await read();
  if (!s) throw new Error('NO_WALLET');
  if (isPasskey(s)) throw new Error('PASSKEY_WALLET_HAS_NO_KEY');
  const { Keypair } = await sdk();
  return Keypair.fromSecret(s.secret);
}

/** Proof of possession for `POST /wallets`: signs the server challenge. */
export async function signChallenge(challenge: string): Promise<string> {
  // TextEncoder, not Buffer: Buffer does not exist in browsers.
  return b64((await keypair()).sign(new TextEncoder().encode(challenge)));
}

/** Device wallets only: passkey wallets have no secret (the passkey is the key). */
export async function backupSecret(): Promise<string> {
  const s = await read();
  if (!s) throw new Error('NO_WALLET');
  if (isPasskey(s)) throw new Error('PASSKEY_WALLET_HAS_NO_KEY');
  return s.secret;
}

/**
 * Signs the user's Soroban authorization entries. Plain and V2 address credentials are both handled: testnet
 * returns V2, and an earlier version that only knew the plain form silently produced unsigned entries.
 */
export async function signAuthEntries(entries: string[], validUntilLedger: number, passphrase: string): Promise<string[]> {
  const stored = await read();
  if (stored && isPasskey(stored)) {
    const { signWithPasskey } = await import('./passkey-signer');
    return signWithPasskey(entries, stored.address, validUntilLedger, passphrase);
  }
  const { Address, authorizeEntry, xdr } = await sdk();
  const kp = await keypair();
  const out: string[] = [];
  for (const e of entries) {
    const entry = xdr.SorobanAuthorizationEntry.fromXDR(e, 'base64');
    const c = entry.credentials;
    const who = c.type === 'sorobanCredentialsAddress' ? Address.fromScAddress(c.address.address).toString() : c.type === 'sorobanCredentialsAddressV2' ? Address.fromScAddress(c.addressV2.address).toString() : null;
    out.push(who === kp.publicKey() ? (await authorizeEntry(entry, kp, validUntilLedger, passphrase)).toXDR('base64') : e);
  }
  return out;
}

/** Signs a classic Stellar transaction (testnet faucet trustline only). */
export async function signClassicTx(txXdr: string, passphrase: string): Promise<string> {
  const { TransactionBuilder } = await sdk();
  const tx = TransactionBuilder.fromXDR(txXdr, passphrase);
  tx.sign(await keypair());
  return tx.toXDR();
}
