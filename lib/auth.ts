'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from './store';

/** Redirects anonymous visitors to onboarding and brings them back afterwards. */
export function useRequireAuth(): { ready: boolean } {
  const status = useSession((s) => s.status);
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (status === 'anon') router.replace(`/onboarding?next=${encodeURIComponent(path)}`);
  }, [status, router, path]);
  return { ready: status === 'authed' };
}
