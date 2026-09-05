// ============================================================================
// src/lib/store/EvidenceDrawerProvider.tsx — erd.md Part 6 §6.8
//
// Global drawer state: which evidence refs are open and at what index, so
// any evidence chip anywhere in the app can open the same drawer instance
// (mounted once in the root layout) with prev/next across a finding's refs.
// ============================================================================

'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { EvidenceRef } from '@/lib/contracts/types';

interface DrawerState {
  refs: EvidenceRef[];
  index: number;
  /** The chip that opened the drawer, so focus returns to it on close. */
  triggerEl: HTMLElement | null;
}

interface EvidenceDrawerContextValue {
  state: DrawerState | null;
  open: (refs: EvidenceRef[], index?: number) => void;
  close: () => void;
  next: () => void;
  prev: () => void;
}

const EvidenceDrawerContext = createContext<EvidenceDrawerContextValue | null>(null);

export function EvidenceDrawerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DrawerState | null>(null);

  const open = useCallback((refs: EvidenceRef[], index = 0) => {
    if (refs.length === 0) return;
    const triggerEl = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
    setState({ refs, index, triggerEl });
  }, []);
  const close = useCallback(() => {
    setState((s) => {
      s?.triggerEl?.focus();
      return null;
    });
  }, []);
  const next = useCallback(() => setState((s) => (s ? { ...s, index: (s.index + 1) % s.refs.length } : s)), []);
  const prev = useCallback(() => setState((s) => (s ? { ...s, index: (s.index - 1 + s.refs.length) % s.refs.length } : s)), []);

  const value = useMemo(() => ({ state, open, close, next, prev }), [state, open, close, next, prev]);

  return <EvidenceDrawerContext.Provider value={value}>{children}</EvidenceDrawerContext.Provider>;
}

export function useEvidenceDrawer(): EvidenceDrawerContextValue {
  const ctx = useContext(EvidenceDrawerContext);
  if (!ctx) throw new Error('useEvidenceDrawer must be used within an EvidenceDrawerProvider');
  return ctx;
}
