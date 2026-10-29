'use client';

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/app-shell';
import { getToken } from '@/lib/api';

/** Signed-in area: no token sends you to sign in. */
export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (getToken()) setReady(true);
    else router.replace('/login');
  }, [router]);
  if (!ready) return null;
  return (
    <Suspense fallback={null}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
