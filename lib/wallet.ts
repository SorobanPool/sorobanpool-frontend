import { del, get, set } from 'idb-keyval';

/**
 * Device wallet (ADR 0001): an ed25519 key generated on this device. It is the interim answer until the passkey
 * smart-wallet decision is made. The key never leaves the device; the backend only ever sees public keys and
 * signatures. The Stellar SDK is large, so it is loaded only when something is actually signed.
 */
const KEY = 'sp.wallet.v1';

interface Stored {
  secret: string;
  publicKey: string;
  /** WebAuthn credential used as a "confirm with fingerprint/face" gate before signing (not a key derivation). */
  credentialId?: string;
}

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

export async function loadWallet(): Promise<{ publicKey: string } | null> {
  const s = await read();
  return s ? { publicKey: s.publicKey } : null;
}

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
  const { Keypair } = await sdk();
  return Keypair.fromSecret(s.secret);
}

/** Proof of possession for `POST /wallets`: signs the server challenge. */
export async function signChallenge(challenge: string): Promise<string> {
  // TextEncoder, not Buffer: Buffer does not exist in browsers.
  return b64((await keypair()).sign(new TextEncoder().encode(challenge)));
}

export async function backupSecret(): Promise<string> {
  const s = await read();
  if (!s) throw new Error('NO_WALLET');
  return s.secret;
}

/**
 * Signs the user's Soroban authorization entries. Plain and V2 address credentials are both handled: testnet
 * returns V2, and an earlier version that only knew the plain form silently produced unsigned entries.
 */
export async function signAuthEntries(entries: string[], validUntilLedger: number, passphrase: string): Promise<string[]> {
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
