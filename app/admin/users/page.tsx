'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ErrorExplainer } from '@/components/feedback/ErrorExplainer';
import { api } from '@/lib/api';

interface UserRow { id: string; phone: string; displayName: string | null; walletAddress: string | null; roles: { role: string; level: number }[] }

export default function Users() {
  const t = useTranslations('admin.users');
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const list = useQuery({ queryKey: ['admin', 'users', q], queryFn: () => api<UserRow[]>(`/admin/users?q=${encodeURIComponent(q)}`) });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState<unknown>(null);
  async function run(path: string, body: object) {
    setError(null);
    setMsg('');
    try {
      await api(path, { body });
      setMsg(t('saved'));
      await qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    } catch (e) {
      setError(e);
    }
  }
  const btn = 'min-h-12 rounded-lg border border-neutral-400 px-3 text-sm font-semibold';
  return (
    <div className="space-y-3">
      <label htmlFor="user-q" className="block font-medium">{t('search')}</label>
      <input id="user-q" value={q} onChange={(e) => setQ(e.target.value)} className="h-12 w-full rounded-lg border border-neutral-400 px-3 text-lg" />
      {list.error && <ErrorExplainer error={list.error} />}
      <ul className="space-y-3">
        {list.data?.map((u) => (
          <li key={u.id} className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4" data-testid="user-row">
            <p className="font-semibold">{u.displayName ?? u.phone}</p>
            <p className="text-sm text-neutral-700">{u.phone} · {t('roles')}: {u.roles.map((r) => `${r.role}${r.level ? ` L${r.level}` : ''}`).join(', ')}</p>
            <div className="flex flex-wrap gap-2">
              {(['ORGANIZER', 'ARBITER'] as const).map((role) => <button key={role} className={btn} onClick={() => void run(`/admin/users/${u.id}/roles`, { role })}>{t('grant', { role })}</button>)}
              {u.walletAddress && (['Trader', 'Organizer'] as const).map((role) => <button key={role} className={btn} onClick={() => void run(`/admin/users/${u.id}/attest`, { role, level: 1 })}>{t('attest', { role })}</button>)}
            </div>
          </li>
        ))}
      </ul>
      {msg && <p role="status" className="rounded-lg bg-emerald-50 p-3 font-semibold text-emerald-900">{msg}</p>}
      {error !== null && <ErrorExplainer error={error} />}
    </div>
  );
}
