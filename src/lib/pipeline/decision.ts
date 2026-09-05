// ============================================================================
// src/lib/pipeline/decision.ts
//
// POST /api/crosscheck's logic (erd.md Part 5 §5.7, Part 2 §5.5). Runs both
// crosscheck definitions in parallel, downgrades any finding whose
// counter-evidence was entirely dropped, recomputes both quantifications in
// TypeScript from the already-extracted profile, and attaches
// statementId/provenance.
// ============================================================================

import { createHash } from 'node:crypto';
import { nanoid } from 'nanoid';
import { CROSSCHECK_DEFS } from '@/lib/pipeline/prompts';
import { runCrosscheckDef } from '@/lib/pipeline/crosscheck';
import {
  computeOptionDilutionQuantification,
  computeRecurringRevenueQuantification,
  reconcileQuantification,
} from '@/lib/pipeline/quantify';
import type {
  CompanyProfile,
  Crosscheck,
  CrosscheckId,
  DecisionResult,
  EvidenceRef,
  SourceDoc,
  StageFailure,
} from '@/lib/contracts/types';

const COMING_SOON: DecisionResult['comingSoon'] = [
  { workstream: 'legal', label: 'Legal & regulatory', description: 'Litigation, licensure, and regulatory compliance review.' },
  { workstream: 'tax', label: 'Tax', description: 'Tax structuring, exposure, and historical filings review.' },
  { workstream: 'hr', label: 'HR & people', description: 'Key-person risk, compensation, and benefits review.' },
  { workstream: 'operations', label: 'IT & operations', description: 'Systems, security, and operational resilience review.' },
];

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function computeQuantification(id: CrosscheckId, profile: CompanyProfile, counterEvidence: EvidenceRef[]) {
  return id === 'recurring_revenue'
    ? computeRecurringRevenueQuantification(profile)
    : computeOptionDilutionQuantification(profile, counterEvidence);
}

export async function runDecision(
  docIds: SourceDoc['id'][],
  profile: CompanyProfile,
  allDocs: SourceDoc[],
): Promise<DecisionResult> {
  const relevantDefs = CROSSCHECK_DEFS.filter(({ def }) => def.docIds.some((id) => docIds.includes(id)));

  const settled = await Promise.allSettled(
    relevantDefs.map(({ def, version }) => runCrosscheckDef(def, version, allDocs).then((run) => ({ def, version, run }))),
  );

  const crosschecks: Crosscheck[] = [];
  const failures: StageFailure[] = [];

  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i]!;
    const def = relevantDefs[i]!.def;

    if (outcome.status === 'rejected') {
      failures.push({
        docId: undefined,
        code: 'LLM_ERROR',
        message: `${def.id}: ${outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)}`,
      });
      continue;
    }

    const { version, run } = outcome.value;
    const { data, model, ms, droppedEvidenceRefs } = run;

    // Never ship a finding with dead links — if every counter-evidence ref
    // was dropped, the finding can't be substantiated to the analyst.
    const status = data.status === 'contradiction_found' && data.counterEvidence.length === 0
      ? 'inconclusive'
      : data.status;

    const computed =
      status === 'contradiction_found' ? computeQuantification(def.id, profile, data.counterEvidence) : null;
    const modelQuantification = data.quantification;
    const quantification = status === 'contradiction_found' ? reconcileQuantification(computed, modelQuantification) : null;

    const statementId = `crosscheck:${nanoid()}:${def.id}`;

    crosschecks.push({
      id: def.id,
      title: def.title,
      workstream: def.workstream,
      status,
      claim: data.claim,
      counterEvidence: data.counterEvidence,
      explanation: data.explanation,
      quantification,
      severityHint: data.severityHint,
      suggestedMemoLanguage: data.suggestedMemoLanguage,
      modelConfidence: data.modelConfidence,
      statementId,
      provenance: {
        statementId,
        stage: 'decision',
        actor: 'model',
        producedBy: model,
        promptVersion: version,
        inputHash: sha256Hex(JSON.stringify({ defId: def.id, docIds: def.docIds, profileStatementId: profile.statementId })),
        generatedAt: new Date().toISOString(),
        latencyMs: ms,
      },
      analystDecision: 'pending',
      analystNote: null,
    });

    if (droppedEvidenceRefs > 0) {
      failures.push({ code: 'EVIDENCE_DROPPED', message: `${def.id}: dropped ${droppedEvidenceRefs} unresolved evidence ref(s)` });
    }
  }

  if (crosschecks.length === 0) {
    throw new Error('Crosscheck failed for every definition');
  }

  return {
    crosschecks,
    comingSoon: COMING_SOON,
    failures,
    generatedAt: new Date().toISOString(),
  };
}
