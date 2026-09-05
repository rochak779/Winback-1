import type { Run, SourceDoc } from '@/lib/contracts/types';
import { mockRun } from '@/lib/fixtures/mockRun';
import { walkEvidence } from '@/lib/evidence';
import type { OwnedGraphSession } from '@/lib/graph/types';

/** Public, synthetic historical examples, never live pipeline output or a user's saved work.
 * Reuses the existing illustrative financials; namespaces source blocks per historical snapshot.
 * Blackwood and Cascade also occur in the actual Kestrel target documents.
 */
export const HISTORICAL_OWNER = 'public-historical-preview';
const examples = [
  { id: 'historical-alder', name: 'Alder', company: 'Alderbrook Care Ltd', at: '2026-06-01T12:00:00.000Z' },
  { id: 'historical-cedar', name: 'Cedar', company: 'Cedarbridge Diagnostics Inc', at: '2026-07-01T12:00:00.000Z' },
];

const snapshots = examples.map((example, index) => {
  const replacements = new Map([
    ['Meridian Health Partners', example.company],
    ['Project Meridian', `Project ${example.name} — Seeded historical`],
    ['run-meridian-demo', example.id],
    ['Northgate Health Network', 'Blackwood Regional Health Network'],
    ['Northbridge Capital', 'Cascade Growth Partners'],
  ]);
  // Other names are deliberately distinct, so only actual exact matches connect the snapshots.
  for (const row of mockRun.extraction!.profile.contracts) {
    if (!replacements.has(row.customer)) replacements.set(row.customer, `${example.name} ${row.customer}`);
  }
  for (const row of mockRun.extraction!.profile.capTable) {
    if (!replacements.has(row.holder)) replacements.set(row.holder, `${example.name} ${row.holder}`);
  }
  for (const row of mockRun.extraction!.profile.optionGrants) replacements.set(row.grantee, `${example.name} ${row.grantee}`);
  let json = JSON.stringify(mockRun);
  for (const [before, after] of replacements) json = json.replaceAll(before, after);
  const run: Run = JSON.parse(json);
  const offset = index * 20;
  for (const doc of run.docs) for (const block of doc.blocks) {
    block.id = `${example.id}:${block.id}`;
    block.page += offset;
    block.section = `${example.name} · ${block.section ?? block.id}`;
  }
  walkEvidence(run, (refs) => refs.map((ref) => ({ ...ref, blockId: `${example.id}:${ref.blockId}`, page: ref.page + offset })));
  // Make fixture provenance explicit; do not misrepresent these as recorded model calls.
  function markSeed(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    if ('producedBy' in record) {
      record.producedBy = 'seeded-historical-fixture';
      record.actor = 'system';
      record.promptVersion = null;
      record.latencyMs = null;
    }
    if ('generatedAt' in record) record.generatedAt = example.at;
    Object.values(record).forEach(markSeed);
  }
  markSeed(run);
  for (const stage of Object.values(run.stages)) {
    stage.startedAt = example.at;
    stage.finishedAt = example.at;
  }
  const session = {
    id: example.id, userId: HISTORICAL_OWNER, deal: { ...run.deal!, id: example.id, createdAt: example.at },
    extraction: run.extraction, benchmark: run.benchmark, portfolio: run.portfolio,
    decision: run.decision, memo: run.memo, stages: run.stages,
    createdAt: example.at, updatedAt: example.at, version: 1 as const, historical: true,
  } satisfies OwnedGraphSession & Pick<Run, 'stages' | 'createdAt' | 'version'>;
  return { session, docs: run.docs };
});

export const SEED_SESSIONS = snapshots.map(({ session }) => session);

/** Separate archive from TARGET_DOCS: fixture refs can never resolve to live target blocks. */
export const SEED_DOCS: SourceDoc[] = mockRun.docs.map((doc) => {
  const blocks = snapshots.flatMap((snapshot) => snapshot.docs.find((item) => item.id === doc.id)!.blocks);
  return {
    ...doc, title: `Seeded historical archive — ${doc.kind.replaceAll('_', ' ')}`,
    filename: `historical-${doc.id}.txt`, dateLabel: 'Synthetic historical examples',
    pages: Math.max(...blocks.map((block) => block.page)), blocks,
  };
});
