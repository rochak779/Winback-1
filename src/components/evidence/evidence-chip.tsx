// ============================================================================
// src/components/evidence/evidence-chip.tsx — erd.md Part 6 §6.5, §6.8
//
// Every extracted value with evidence gets one of these. Clicking (or
// Enter/Space when focused) opens the evidence drawer at that ref. A value
// with no evidence renders `—` instead — see <EvidenceValue> below.
// ============================================================================

'use client';

import { FileTextIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EvidenceRef } from '@/lib/contracts/types';
import { useEvidenceDrawer } from '@/lib/store/EvidenceDrawerProvider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function EvidenceChip({
  refs,
  index = 0,
  label,
  className,
}: {
  /** The full set of refs this chip belongs to — enables prev/next in the drawer. */
  refs: EvidenceRef[];
  index?: number;
  label?: string;
  className?: string;
}) {
  const { open } = useEvidenceDrawer();
  if (refs.length === 0) return null;

  return (
    <button
      type="button"
      onClick={() => open(refs, index)}
      aria-label={`View source evidence${label ? `: ${label}` : ''}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        'bg-muted text-muted-foreground border-border hover:border-attention hover:text-attention-foreground active:bg-attention/20 active:text-attention-foreground',
        className,
      )}
    >
      <FileTextIcon className="size-3" />
      {label ?? 'Evidence'}
    </button>
  );
}

/** Renders a field's value with its evidence chip, or a muted `—` when there's none. */
export function EvidenceValue({ value, refs }: { value: string; refs: EvidenceRef[] }) {
  if (refs.length === 0) {
    return (
      <Tooltip>
        <TooltipTrigger render={<span className="cursor-default text-muted-foreground" tabIndex={0} />}>—</TooltipTrigger>
        <TooltipContent>Not stated in documents</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{value}</span>
      <EvidenceChip refs={refs} />
    </span>
  );
}
