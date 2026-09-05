// ============================================================================
// src/components/evidence/evidence-drawer.tsx — erd.md Part 6 §6.8
//
// The interaction the demo turns on. Mounted once, near the root — every
// chip in the app opens this same instance via useEvidenceDrawer(). Built on
// shadcn's Sheet (a controlled Dialog), which already gives us Esc-to-close,
// backdrop click, and a focus trap for free; we add Tab→open, arrow-key
// prev/next, and the scroll-into-view + quote highlight ourselves.
// ============================================================================

'use client';

import { useEffect, useRef } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRun } from '@/lib/store/RunProvider';
import { useEvidenceDrawer } from '@/lib/store/EvidenceDrawerProvider';
import { resolveEvidence } from '@/lib/client/evidence';
import type { Block } from '@/lib/contracts/types';

/** Splits a block's text into [before, matched quote, after] for the strong highlight. */
function splitOnQuote(text: string, quote: string): [string, string, string] | null {
  const idx = text.toLowerCase().indexOf(quote.toLowerCase());
  if (idx === -1) return null;
  return [text.slice(0, idx), text.slice(idx, idx + quote.length), text.slice(idx + quote.length)];
}

function BlockRow({ block, isCited, quote, quoteVerified }: { block: Block; isCited: boolean; quote: string; quoteVerified: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isCited) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [isCited]);

  const split = isCited && quoteVerified ? splitOnQuote(block.text, quote) : null;

  return (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border px-3 py-2 text-sm leading-relaxed',
        isCited ? 'border-evidence-foreground/40 bg-evidence' : 'border-transparent',
      )}
    >
      <div className="mb-1 text-xs text-muted-foreground">
        {block.section ? `${block.section} · ` : ''}
        {block.page}
      </div>
      {split ? (
        <p>
          {split[0]}
          <mark className="rounded bg-attention px-0.5 text-attention-foreground">{split[1]}</mark>
          {split[2]}
        </p>
      ) : (
        <p>{block.text}</p>
      )}
    </div>
  );
}

export function EvidenceDrawer() {
  const { run } = useRun();
  const { state, close, next, prev } = useEvidenceDrawer();
  const open = state !== null;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, next, prev]);

  if (!state) return null;

  const ref = state.refs[state.index];
  const resolved = ref ? resolveEvidence(ref, run.docs) : null;

  return (
    <Sheet open={open} onOpenChange={(next) => !next && close()}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-md">
        {resolved ? (
          <>
            <SheetHeader className="border-b">
              <SheetTitle>{resolved.doc.title}</SheetTitle>
              <SheetDescription>
                {resolved.doc.filename} ·{' '}
                {resolved.doc.pageNoun.charAt(0).toUpperCase() + resolved.doc.pageNoun.slice(1)} {resolved.block.page}
              </SheetDescription>
            </SheetHeader>
            {state.refs.length > 1 && (
              <div className="flex items-center justify-between border-b px-4 py-2 text-xs text-muted-foreground">
                <span>
                  {state.index + 1} of {state.refs.length} citations
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={prev} aria-label="Previous citation">
                    <ChevronLeftIcon />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={next} aria-label="Next citation">
                    <ChevronRightIcon />
                  </Button>
                </div>
              </div>
            )}
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {resolved.doc.blocks
                .filter((b) => !b.deprecated)
                .map((b) => (
                  <BlockRow
                    key={b.id}
                    block={b}
                    isCited={b.id === resolved.block.id}
                    quote={resolved.ref.quote}
                    quoteVerified={resolved.ref.quoteVerified}
                  />
                ))}
            </div>
          </>
        ) : (
          <div className="p-4 text-sm text-muted-foreground">This citation could not be resolved.</div>
        )}
      </SheetContent>
    </Sheet>
  );
}
