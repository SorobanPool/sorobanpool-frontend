import { describe, expect, it } from 'vitest';
import en from '../messages/en.json';
import pcm from '../messages/pcm.json';

const keys = (o: unknown, prefix = ''): string[] =>
  Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => (typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

describe('i18n completeness', () => {
  it('has the same message keys in English and Pidgin', () => {
    const a = keys(en).sort();
    const b = keys(pcm).sort();
    expect(a.filter((k) => !b.includes(k)), 'missing in Pidgin').toEqual([]);
    expect(b.filter((k) => !a.includes(k)), 'missing in English').toEqual([]);
  });
  it('has no empty strings', () => {
    for (const [lang, m] of [['en', en], ['pcm', pcm]] as const) {
      for (const k of keys(m)) {
        const v = k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], m);
        expect(String(v).trim(), `${lang}:${k}`).not.toBe('');
      }
    }
  });
  it('uses the same placeholders in both languages', () => {
    const ph = (s: string) => [...s.matchAll(/\{(\w+)[,}]/g)].map((m) => m[1]).sort().join(',');
    for (const k of keys(en)) {
      const get = (m: unknown) => k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], m) as string;
      expect(ph(get(pcm)), `placeholders in ${k}`).toBe(ph(get(en)));
    }
  });
});


const BANNED = ['seed phrase', 'secret phrase', 'private key', 'mnemonic', 'gas', 'wallet address', 'blockchain', 'smart contract', 'transaction hash'];
// Info sheets may name these terms on purpose. Keep the list short and say why in docs/ux-writing.md.
const ALLOWLIST = new Set<string>([]);

describe('plain-language copy', () => {
  for (const [lang, m] of [['en', en], ['pcm', pcm]] as const) {
    it(`has no banned crypto terms in ${lang}`, () => {
      const hits: string[] = [];
      for (const k of keys(m)) {
        if (ALLOWLIST.has(k)) continue;
        const v = String(k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], m));
        for (const term of BANNED) {
          if (new RegExp(`\\b${term}\\b`, 'i').test(v)) hits.push(`${lang}:${k} contains "${term}"`);
        }
      }
      expect(hits).toEqual([]);
    });
  }
});
