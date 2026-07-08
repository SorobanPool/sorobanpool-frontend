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
