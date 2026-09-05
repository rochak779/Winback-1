// ============================================================================
// src/components/app-shell/deal-gate.tsx — erd.md Part 2 §8
//
// RunProvider holds one Run for the whole app. Landing directly on
// /deal/[id]/* (a refresh, a shared link) means the in-memory run might not
// be this one yet — rehydrate it from localStorage, or bounce to Plan if
// nothing was ever saved under this id.
// ============================================================================

'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { loadRunFromStorage, useRun } from '@/lib/store/RunProvider';

export function DealGate({ id, children }: { id: string; children: ReactNode }) {
  const { run, dispatch } = useRun();
  const router = useRouter();
  const isCurrent = run.id === id;

  useEffect(() => {
    if (run.id === id) return;
    const stored = loadRunFromStorage(id);
    if (stored) {
      dispatch({ type: 'HYDRATE', run: stored });
    } else {
      router.replace('/');
    }
    // `dispatch`/`router` are stable — only re-check when the route id or the loaded run actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, run.id]);

  if (!isCurrent) return null;
  return <>{children}</>;
}
