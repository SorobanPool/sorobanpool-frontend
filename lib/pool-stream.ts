'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiUrl } from './api';

/** Minimal EventSource surface, so tests can supply a fake. */
export interface EventSourceLike {
  addEventListener(type: string, cb: (e: { data: string }) => void): void;
  close(): void;
}

/**
 * Subscribes to a pool's live stream and calls `onChange` for every update after the first (the first frame only
 * restates what the page just loaded). Returns a cleanup. EventSource reconnects by itself after a drop.
 */
export function subscribePool(id: string, onChange: () => void, make: (url: string) => EventSourceLike = (u) => new EventSource(u)): () => void {
  let es: EventSourceLike;
  try {
    es = make(apiUrl(`/pools/${encodeURIComponent(id)}/stream`));
  } catch {
    return () => {}; // no EventSource: the page's polling still keeps it fresh
  }
  let first = true;
  es.addEventListener('pool', () => {
    if (first) { first = false; return; }
    onChange();
  });
  return () => es.close();
}

/** Refreshes the cached pool as soon as the indexer applies an event; polling remains as the fallback. */
export function usePoolStream(id: string, enabled: boolean): void {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled || !id) return;
    return subscribePool(id, () => void qc.invalidateQueries({ queryKey: ['pool', id] }));
  }, [id, enabled, qc]);
}
