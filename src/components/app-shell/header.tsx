// ============================================================================
// src/components/app-shell/header.tsx — erd.md Part 6 §6.3
// ============================================================================

'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Stepper } from '@/components/app-shell/stepper';
import { useIsMockRun, useRun } from '@/lib/store/RunProvider';

export function Header() {
  const { run } = useRun();
  const isMock = useIsMockRun();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/75">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-6">
        <Link href="/" className="shrink-0 font-heading text-sm font-semibold tracking-tight">
          WinBack
        </Link>
        {run.deal && <span className="shrink-0 truncate text-sm text-muted-foreground">{run.deal.name}</span>}
        <div className="flex-1" />
        <Stepper />
        {isMock && (
          <Badge className="shrink-0 bg-amber-500/20 text-amber-600 border-amber-500/30" variant="outline">
            MOCK
          </Badge>
        )}
      </div>
    </header>
  );
}
