// ============================================================================
// src/lib/pipeline/crosscheck.ts
//
// The shared machinery behind every crosscheck definition (erd.md Part 5
// §5.7): one Gemini call per definition, general diligence-procedure prompt,
// evidence validation. `POST /api/crosscheck` (session 2.4) adds the
// quantification recompute and downgrade-on-dead-links logic on top of this;
// `scripts/tune-crosscheck.ts` (session 2.3) uses this directly to iterate on
// the prompts against the real documents.
// ============================================================================

import { Type, type Schema } from '@google/genai';
import { z } from 'zod';
import { generateJson } from '@/lib/pipeline/gemini';
import { renderDocForPrompt, validateEvidence } from '@/lib/evidence';
import { ModelEvidenceRefSchema, evidenceArraySchema, nullable, toEvidenceRef } from '@/lib/pipeline/schema-helpers';
import { CrosscheckStatusSchema } from '@/lib/contracts/schemas';
import type { CrosscheckId, EvidenceRef, SourceDoc, SourceDocId, Workstream } from '@/lib/contracts/types';

export interface CrosscheckDef {
  id: CrosscheckId;
  title: string;
  workstream: Workstream;
  docIds: SourceDocId[];
  /** A general diligence procedure — see erd.md Part 5 §5.2 Rule 2. Never answer-shaped. */
  procedure: string;
  /** What to quantify IF a gap is found. Still general — never the planted numbers. */
  quantificationHint: string;
}

// ----------------------------------------------------------------------------
// What the model must return
// ----------------------------------------------------------------------------

const ModelQuantificationSchema = z.object({
  label: z.string(),
  claimedValue: z.number(),
  observedValue: z.number(),
  unit: z.enum(['%', 'x', 'shares', 'USDm']),
  note: z.string(),
});

export const ModelCrosscheckSchema = z.object({
  status: CrosscheckStatusSchema,
  claim: z.object({ text: z.string(), evidence: z.array(ModelEvidenceRefSchema) }),
  counterEvidence: z.array(ModelEvidenceRefSchema),
  explanation: z.string(),
  quantification: ModelQuantificationSchema.nullable(),
  severityHint: z.enum(['high', 'medium', 'low']),
  suggestedMemoLanguage: z.string(),
  modelConfidence: z.number(),
});
export type ModelCrosscheck = z.infer<typeof ModelCrosscheckSchema>;

const crosscheckResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    status: {
      type: Type.STRING,
      format: 'enum',
      enum: CrosscheckStatusSchema.options as unknown as string[],
    },
    claim: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING, description: "What the claiming party asserted, in the claiming party's own terms." },
        evidence: evidenceArraySchema('Blocks the claim was read from.'),
      },
      required: ['text', 'evidence'],
    },
    counterEvidence: evidenceArraySchema(
      'Blocks from the other document(s) that bear on whether the claim holds. Empty if status is consistent.',
    ),
    explanation: {
      type: Type.STRING,
      description: '2-4 neutral sentences explaining what the records show, with no verdict language.',
    },
    quantification: nullable({
      type: Type.OBJECT,
      description: 'Populate only when a gap between claim and records is found; otherwise omit by returning null.',
      properties: {
        label: { type: Type.STRING },
        claimedValue: { type: Type.NUMBER },
        observedValue: { type: Type.NUMBER },
        unit: { type: Type.STRING, format: 'enum', enum: ['%', 'x', 'shares', 'USDm'] },
        note: { type: Type.STRING, description: 'How observedValue was derived from the records.' },
      },
      required: ['label', 'claimedValue', 'observedValue', 'unit', 'note'],
    }),
    severityHint: { type: Type.STRING, format: 'enum', enum: ['high', 'medium', 'low'] },
    suggestedMemoLanguage: { type: Type.STRING, description: 'One neutral, IC-ready sentence.' },
    modelConfidence: { type: Type.NUMBER, description: '0..1' },
  },
  required: [
    'status',
    'claim',
    'counterEvidence',
    'explanation',
    'quantification',
    'severityHint',
    'suggestedMemoLanguage',
    'modelConfidence',
  ],
};

// ----------------------------------------------------------------------------
// Prompt
// ----------------------------------------------------------------------------

function buildCrosscheckPrompt(def: CrosscheckDef, docs: SourceDoc[]): { systemInstruction: string; prompt: string } {
  const systemInstruction =
    'You are a diligence analyst performing a crosscheck as part of an acquisition review: testing a ' +
    "claim made in one document against what the underlying records in another document actually show. " +
    'You do not know in advance whether a discrepancy exists — it may turn out the records fully support ' +
    'the claim, may be silent on the point, or may contradict it. Choose `status` honestly based only on ' +
    'what the documents say: `consistent` if the records support the claim, `contradiction_found` if they ' +
    'do not, `inconclusive` if the documents do not settle the question either way. Every assertion you ' +
    'make must carry the block id(s) — the bracketed tokens like [s4-b2] — it was read from, with a short ' +
    'verbatim quote from that exact block. Do not introduce any figure not stated in the documents.';

  const prompt = [
    `Procedure: ${def.procedure}`,
    '',
    `If your procedure finds a gap between the claim and the records, quantify it: ${def.quantificationHint}`,
    '',
    'Source documents, each block preceded by its bracketed id:',
    ...docs.map((doc) => `\n--- ${doc.title} ---\n${renderDocForPrompt(doc)}`),
  ].join('\n');

  return { systemInstruction, prompt };
}

// ----------------------------------------------------------------------------
// One call per definition
// ----------------------------------------------------------------------------

/** ModelCrosscheck, but with claim.evidence / counterEvidence validated into full EvidenceRefs. */
type ValidatedCrosscheck = Omit<ModelCrosscheck, 'claim' | 'counterEvidence'> & {
  claim: { text: string; evidence: EvidenceRef[] };
  counterEvidence: EvidenceRef[];
};

export interface CrosscheckRunResult {
  model: string;
  ms: number;
  /** The model's output with claim.evidence / counterEvidence already validated against the real docs. */
  data: ValidatedCrosscheck;
  droppedEvidenceRefs: number;
}

export async function runCrosscheckDef(
  def: CrosscheckDef,
  version: string,
  allDocs: SourceDoc[],
): Promise<CrosscheckRunResult> {
  const docs = def.docIds
    .map((id) => allDocs.find((d) => d.id === id))
    .filter((d): d is SourceDoc => Boolean(d));
  const { systemInstruction, prompt } = buildCrosscheckPrompt(def, docs);

  const { data, model, ms } = await generateJson<ModelCrosscheck>({
    purpose: `crosscheck:${def.id}`,
    systemInstruction,
    prompt,
    responseSchema: crosscheckResponseSchema,
    zodSchema: ModelCrosscheckSchema,
    // erd.md §5.10 suggests reasoning-tier for crosscheck; measured against
    // this project's actual key, gemini-pro-latest ('reasoning') took 60-90s
    // per call — past the 45s timeout and close to the 60s function budget.
    // gemini-flash-latest ('fast') is what extraction already uses reliably
    // under 20s/call, so crosscheck uses it too rather than ship a route
    // that routinely times out.
    model: 'fast',
  });

  const claimResult = validateEvidence(data.claim.evidence.map(toEvidenceRef), allDocs, {
    purpose: `crosscheck:${def.id}:claim@${version}`,
  });
  const counterResult = validateEvidence(data.counterEvidence.map(toEvidenceRef), allDocs, {
    purpose: `crosscheck:${def.id}:counter@${version}`,
  });

  return {
    model,
    ms,
    data: {
      ...data,
      claim: { ...data.claim, evidence: claimResult.valid },
      counterEvidence: counterResult.valid,
    },
    droppedEvidenceRefs: claimResult.dropped + counterResult.dropped,
  };
}
