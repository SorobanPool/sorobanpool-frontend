'use client';
import { create } from 'zustand';
import { clearApiCache } from '@/components/ServiceWorker';
import { api, session } from './api';
import { loadWallet } from './wallet';

export interface Me {
  id: string;
  phone: string;
  displayName: string | null;
  language: string;
  walletAddress: string | null;
  roles: string[];
}

interface SessionState {
  status: 'loading' | 'anon' | 'authed';
  me: Me | null;
  devicePublicKey: string | null;
  bootstrap(): Promise<void>;
  signedIn(tokens: { accessToken: string; refreshToken: string }): Promise<void>;
  reload(): Promise<void>;
  signOut(): void;
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  me: null,
  devicePublicKey: null,
  async bootstrap() {
    const wallet = await loadWallet();
    set({ devicePublicKey: wallet?.publicKey ?? null });
    if (!session.hasRefresh && !session.access) return set({ status: 'anon', me: null });
    try {
      set({ status: 'authed', me: await api<Me>('/me') });
    } catch {
      session.clear();
      set({ status: 'anon', me: null });
    }
  },
  async signedIn(tokens) {
    session.set(tokens);
    await get().reload();
  },
  async reload() {
    const wallet = await loadWallet();
    set({ status: 'authed', me: await api<Me>('/me'), devicePublicKey: wallet?.publicKey ?? null });
  },
  signOut() {
    session.clear();
    clearApiCache();
    set({ status: 'anon', me: null });
  },
}));
