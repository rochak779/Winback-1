// ============================================================================
// src/components/audit/derived-marker.tsx — erd.md Part 9.6
//
// The "ƒ" marker for a deterministically-computed value: a median, a
// concentration percentage, a crosscheck quantification. Distinct from
// <EvidenceChip> (which points at a document) — this points at a formula and
// the already-known inputs it was computed from. Click or hover reveals it.
// ============================================================================

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export function DerivedMarker({ formula, inputs, className }: { formula: string; inputs: string[]; className?: string }) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          'inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-[10px] font-serif italic text-muted-foreground transition-colors hover:border-attention hover:text-attention-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          className,
        )}
        aria-label="Show how this value was derived"
      >
        ƒ
      </PopoverTrigger>
      <PopoverContent>
        <p className="font-medium">{formula}</p>
        <p className="mt-1 text-xs text-muted-foreground">Computed · deterministic</p>
        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {inputs.map((input) => (
            <li key={input}>{input}</li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
