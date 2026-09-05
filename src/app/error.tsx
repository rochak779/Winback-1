// ============================================================================
// src/app/error.tsx — erd.md Part 6 §6.3
//
// Next's App Router error boundary for this segment tree. Catches
// unexpected render-time exceptions; per-stage API errors are handled
// inline by each screen instead (they're expected, not exceptional).
// ============================================================================

'use client';

import { Button } from '@/components/ui/button';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
      <h1 className="font-heading text-lg font-medium">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        {error.message || 'An unexpected error occurred while rendering this page.'}
      </p>
      <Button onClick={reset}>Retry</Button>
    </div>
  );
}
