'use client';

import { useState } from 'react';
import { CheckIcon, CopyIcon, PencilIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { EvidenceChip } from '@/components/evidence/evidence-chip';
import { useRun } from '@/lib/store/RunProvider';
import type { EvidenceRef } from '@/lib/contracts/types';

function MemoSection({
  section,
  onEdit,
}: {
  section: { id: string; heading: string; body: string; evidence: EvidenceRef[]; originalBody: string | null };
  onEdit: (id: string, body: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.body);

  function saveEdit() {
    onEdit(section.id, draft);
    setEditing(false);
  }

  function cancelEdit() {
    setDraft(section.body);
    setEditing(false);
  }

  return (
    <div className="space-y-2 border-b pb-6 mb-6 last:border-b-0 last:pb-0 last:mb-0">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold tracking-tight">{section.heading}</h3>
        {!editing && (
          <Button size="icon-sm" variant="ghost" onClick={() => setEditing(true)} aria-label="Edit section">
            <PencilIcon />
          </Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3 mt-3">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={6} className="font-mono text-sm" />
          <div className="flex gap-2">
            <Button size="sm" onClick={saveEdit}>
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={cancelEdit}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="prose prose-sm dark:prose-invert mt-2 text-muted-foreground">
          {section.body.split('\n').map((para, i) => (
            <p key={i} className="mb-2 last:mb-0">
              {para}
            </p>
          ))}
        </div>
      )}

      {section.evidence && section.evidence.length > 0 && !editing && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {section.evidence.map((ref, i) => (
            <EvidenceChip key={`${ref.docId}-${ref.blockId}`} refs={section.evidence} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

export function MemoCard() {
  const { run, dispatch } = useRun();
  const memo = run.memo;

  if (!memo) return null;

  function editSection(id: string, body: string) {
    dispatch({ type: 'MEMO_EDIT_SECTION', sectionId: id, body });
  }

  function setStatus(status: 'draft' | 'analyst_edited' | 'approved') {
    dispatch({ type: 'MEMO_STATUS', status });
    toast.success(`Memo marked as ${status.replace('_', ' ')}`);
  }

  async function copyMemo() {
    if (!memo) return;
    const text = memo.sections.map((s) => `## ${s.heading}\n\n${s.body}`).join('\n\n');
    await navigator.clipboard.writeText(text);
    toast.success('Memo copied to clipboard');
  }

  return (
    <Card className="mt-8 border-primary/20 bg-primary/5">
      <CardHeader className="border-b bg-background/50 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Investment Committee Memo</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Drafted based on verified findings and selected insights.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-background">
              {memo.status.replace('_', ' ').toUpperCase()}
            </Badge>
            <Button size="sm" variant="outline" onClick={copyMemo}>
              <CopyIcon className="mr-2 h-4 w-4" /> Copy Full Memo
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-0 pt-6 bg-background">
        {memo.sections.map((section) => (
          <MemoSection key={section.id} section={section} onEdit={editSection} />
        ))}
      </CardContent>
      <CardFooter className="border-t bg-background/50 flex flex-wrap items-center justify-between gap-4 py-4 mt-6">
        <p className="text-xs text-muted-foreground max-w-lg">{memo.disclaimer}</p>
        <div className="flex gap-2">
          {memo.status !== 'approved' && (
            <Button size="sm" onClick={() => setStatus('approved')}>
              <CheckIcon className="mr-2 h-4 w-4" /> Approve for IC
            </Button>
          )}
          {memo.status === 'approved' && (
            <Button size="sm" variant="outline" onClick={() => setStatus('analyst_edited')}>
              <XIcon className="mr-2 h-4 w-4" /> Revoke Approval
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
