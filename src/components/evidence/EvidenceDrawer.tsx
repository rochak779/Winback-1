'use client';

import { useRef } from 'react';
import type { EvidenceRef, SourceDoc } from '@/lib/contracts/types';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';

/** Resolves from supplied documents, synchronously; opening never fetches a source. */
export function EvidenceDrawer({ docs, evidence, docId, onClose }: {
  docs: readonly SourceDoc[]; evidence: EvidenceRef | null; docId: string | null; onClose: () => void;
}) {
  const returnFocus = useRef<Element | null>(null);
  const doc = docs.find((doc) => doc.id === (evidence?.docId ?? docId));
  const open = Boolean(evidence || docId);
  return <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
    <SheetContent className="data-[side=right]:sm:max-w-2xl" style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }} finalFocus={() => {
      const target = returnFocus.current;
      if (target instanceof HTMLElement) return target;
      if (target instanceof SVGElement && 'focus' in target && typeof target.focus === 'function') {
        target.focus();
        return false;
      }
      return null;
    }} initialFocus={(interactionType) => {
      returnFocus.current = document.activeElement;
      // Let Base UI choose the first control; keep its focus trap, Esc and backdrop handling.
      return interactionType !== 'touch';
    }}>
      <SheetHeader>
        <SheetTitle>{doc?.title ?? 'Source unavailable'}</SheetTitle>
        <SheetDescription>{doc ? `${doc.dateLabel} · ${evidence ? `${doc.pageNoun} ${evidence.page} · ${evidence.blockId}` : 'Full document'}` : 'The cited document is not present in this snapshot.'}</SheetDescription>
      </SheetHeader>
      <div className="overflow-y-auto px-6 pb-8">
        {doc?.blocks.map((block) => {
          const cited = block.id === evidence?.blockId;
          const quote = cited && evidence?.quoteVerified ? evidence.quote : '';
          const index = quote ? block.text.indexOf(quote) : -1;
          return <article key={block.id} data-cited={cited} ref={(element) => {
            if (element && cited && element.parentElement) {
              const container = element.parentElement;
              // Scroll only the drawer, never move the underlying graph page.
              container.scrollTop += element.getBoundingClientRect().top - container.getBoundingClientRect().top
                - (container.clientHeight - element.clientHeight) / 2;
            }
          }} className={`mb-4 rounded-lg border p-4 ${cited ? 'border-ring bg-accent' : 'border-transparent'}`}>
            <h3 className="mb-2 text-sm font-medium">{block.section ?? block.id} <span className="text-muted-foreground">· {doc.pageNoun} {block.page}{cited ? ' · Cited block' : ''}</span></h3>
            <p className="whitespace-pre-wrap text-sm leading-7">{index < 0 ? block.text : <>{block.text.slice(0, index)}<mark className="bg-primary px-0.5 text-primary-foreground">{quote}</mark>{block.text.slice(index + quote.length)}</>}</p>
          </article>;
        })}
      </div>
    </SheetContent>
  </Sheet>;
}
