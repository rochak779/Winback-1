// ============================================================================
// src/lib/pipeline/schema-helpers.ts
//
// Shared building blocks for pipeline routes: the Gemini responseSchema
// fragment for an evidence ref (what the model is actually asked to
// produce — page and quoteVerified are set server-side, never by the
// model), the matching zod shape for `generateJson`'s validation retry, and
// a mapper from the model's raw output into a full (unvalidated) EvidenceRef
// ready for `validateEvidence()`.
// ============================================================================

import { Type, type Schema } from '@google/genai';
import { z } from 'zod';
import { SourceDocIdSchema } from '@/lib/contracts/schemas';
import type { EvidenceRef } from '@/lib/contracts/types';

/** What the model must produce for one evidence ref. */
export const modelEvidenceRefSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    docId: { type: Type.STRING, description: 'The docId this evidence comes from, e.g. "mgmt-pres".' },
    blockId: {
      type: Type.STRING,
      description: 'The bracketed block id the fact was read from, e.g. "s4-b2". Must be copied exactly.',
    },
    quote: {
      type: Type.STRING,
      description: 'A short verbatim quote (a few words to one sentence) from that exact block.',
    },
  },
  required: ['docId', 'blockId', 'quote'],
};

/** The zod counterpart of `modelEvidenceRefSchema`, for generateJson's validation retry. */
export const ModelEvidenceRefSchema = z.object({
  docId: SourceDocIdSchema,
  blockId: z.string(),
  quote: z.string(),
});
export type ModelEvidenceRef = z.infer<typeof ModelEvidenceRefSchema>;

/**
 * The model never sets `page` or `quoteVerified` — validateEvidence()
 * overwrites both unconditionally. This just satisfies the full EvidenceRef
 * shape so the raw model output can flow straight into validateEvidence().
 *
 * Models sometimes copy the bracketed prompt token verbatim (`"[s4-b2]"`
 * instead of `"s4-b2"`) despite the schema description asking for the bare
 * id — strip a leading/trailing bracket defensively rather than let a
 * perfectly good citation get dropped over formatting.
 */
export function toEvidenceRef(raw: ModelEvidenceRef): EvidenceRef {
  const blockId = raw.blockId.trim().replace(/^\[|\]$/g, '');
  return { ...raw, blockId, page: 0, quoteVerified: false };
}

export function evidenceArraySchema(description: string): Schema {
  return { type: Type.ARRAY, description, items: modelEvidenceRefSchema };
}

/** A nullable scalar schema — Gemini structured output supports `nullable` directly. */
export function nullable(schema: Schema): Schema {
  return { ...schema, nullable: true };
}
