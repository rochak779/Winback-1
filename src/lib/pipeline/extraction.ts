// ============================================================================
// src/lib/pipeline/extraction.ts
//
// POST /api/extract's logic (erd.md Part 5 §5.4, Part 2 §5.2). One Gemini
// call per document, in parallel, each returning a workstream classification
// and that document's slice of the CompanyProfile with block-id citations.
// Then a deterministic TypeScript merge into one profile, evidence
// validation, and provenance.
//
// Session id / audit wiring is Lane D / Phase 6 work (auth and Firestore are
// deferred — see erd.md session 0.3). `statementId` here uses a per-call
// nanoid as a stand-in until a real session id flows through the request.
// ============================================================================

import { createHash } from 'node:crypto';
import { nanoid } from 'nanoid';
import { Type, type Schema } from '@google/genai';
import { z } from 'zod';
import { generateJson, LlmTimeoutError } from '@/lib/pipeline/gemini';
import { renderDocForPrompt, validateEvidence, walkEvidence } from '@/lib/evidence';
import { ModelEvidenceRefSchema, evidenceArraySchema, nullable, toEvidenceRef } from '@/lib/pipeline/schema-helpers';
import { WorkstreamSchema } from '@/lib/contracts/schemas';
import type {
  CapTableRow,
  CompanyProfile,
  CustomerContract,
  DocClassification,
  EvidenceRef,
  ExtractionResult,
  FinancialYear,
  KeyTerm,
  OptionGrant,
  RevenueMixItem,
  SourceDoc,
  SourceDocId,
  StageFailure,
} from '@/lib/contracts/types';

// ----------------------------------------------------------------------------
// What the model must return (a superset of what any one document can
// address — a call is told which fields it's responsible for in its prompt,
// and to leave the rest null / empty).
// ----------------------------------------------------------------------------

const ModelFinancialYearSchema = z.object({
  fy: z.string(),
  revenueUsdM: z.number(),
  revenueGrowthPct: z.number().nullable(),
  grossMarginPct: z.number().nullable(),
  ebitdaUsdM: z.number().nullable(),
  ebitdaMarginPct: z.number().nullable(),
  evidence: z.array(ModelEvidenceRefSchema),
});

const ModelRevenueMixItemSchema = z.object({
  label: z.string(),
  pct: z.number(),
  evidence: z.array(ModelEvidenceRefSchema),
});

const ModelCustomerContractSchema = z.object({
  customer: z.string(),
  annualValueUsdM: z.number(),
  startDate: z.string(),
  termMonths: z.number().nullable(),
  autoRenew: z.boolean().nullable(),
  cancellationNoticeDays: z.number().nullable(),
  cancellationForConvenience: z.boolean().nullable(),
  classifiedAsRecurringByMgmt: z.boolean().nullable(),
  evidence: z.array(ModelEvidenceRefSchema),
});

const ModelCapTableRowSchema = z.object({
  holder: z.string(),
  securityClass: z.string(),
  shares: z.number(),
  pctFullyDiluted: z.number(),
  evidence: z.array(ModelEvidenceRefSchema),
});

const ModelOptionGrantSchema = z.object({
  grantee: z.string(),
  boardApprovalDate: z.string(),
  options: z.number(),
  strikeUsd: z.number().nullable(),
  reflectedInCapTable: z.boolean().nullable(),
  evidence: z.array(ModelEvidenceRefSchema),
});

const ModelKeyTermSchema = z.object({
  label: z.string(),
  value: z.string(),
  evidence: z.array(ModelEvidenceRefSchema),
});

const ModelProfileSliceSchema = z.object({
  name: z.string().nullable(),
  sector: z.string().nullable(),
  hq: z.string().nullable(),
  foundedYear: z.number().nullable(),
  employees: z.number().nullable(),
  businessSummary: z.string().nullable(),
  financials: z.array(ModelFinancialYearSchema),
  revenueMix: z.array(ModelRevenueMixItemSchema),
  contracts: z.array(ModelCustomerContractSchema),
  capTable: z.array(ModelCapTableRowSchema),
  statedFullyDilutedShares: z.number().nullable(),
  optionGrants: z.array(ModelOptionGrantSchema),
  keyTerms: z.array(ModelKeyTermSchema),
});
type ModelProfileSlice = z.infer<typeof ModelProfileSliceSchema>;

const ModelExtractionSchema = z.object({
  workstream: WorkstreamSchema,
  confidence: z.number(),
  rationale: z.string(),
  profile: ModelProfileSliceSchema,
});
type ModelExtraction = z.infer<typeof ModelExtractionSchema>;

// ----------------------------------------------------------------------------
// The matching Gemini responseSchema.
// ----------------------------------------------------------------------------

const financialYearGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    fy: { type: Type.STRING, description: 'e.g. "FY24"' },
    revenueUsdM: { type: Type.NUMBER },
    revenueGrowthPct: nullable({ type: Type.NUMBER }),
    grossMarginPct: nullable({ type: Type.NUMBER }),
    ebitdaUsdM: nullable({ type: Type.NUMBER }),
    ebitdaMarginPct: nullable({ type: Type.NUMBER }),
    evidence: evidenceArraySchema('Blocks this financial year figure was read from.'),
  },
  required: ['fy', 'revenueUsdM', 'revenueGrowthPct', 'grossMarginPct', 'ebitdaUsdM', 'ebitdaMarginPct', 'evidence'],
};

const revenueMixItemGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    label: { type: Type.STRING, description: 'e.g. "Recurring / subscription"' },
    pct: { type: Type.NUMBER },
    evidence: evidenceArraySchema('Blocks this revenue-mix figure was read from.'),
  },
  required: ['label', 'pct', 'evidence'],
};

const customerContractGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    customer: { type: Type.STRING },
    annualValueUsdM: { type: Type.NUMBER },
    startDate: { type: Type.STRING, description: 'YYYY-MM-DD or YYYY-MM' },
    termMonths: nullable({ type: Type.NUMBER }),
    autoRenew: nullable({ type: Type.BOOLEAN }),
    cancellationNoticeDays: nullable({ type: Type.NUMBER }),
    cancellationForConvenience: nullable({
      type: Type.BOOLEAN,
      description: 'True only if the contract lets the customer terminate for convenience / any reason / without cause.',
    }),
    classifiedAsRecurringByMgmt: nullable({ type: Type.BOOLEAN }),
    evidence: evidenceArraySchema('Clauses this contract summary was read from.'),
  },
  required: [
    'customer',
    'annualValueUsdM',
    'startDate',
    'termMonths',
    'autoRenew',
    'cancellationNoticeDays',
    'cancellationForConvenience',
    'classifiedAsRecurringByMgmt',
    'evidence',
  ],
};

const capTableRowGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    holder: { type: Type.STRING },
    securityClass: { type: Type.STRING, description: 'e.g. "Common", "Series A Preferred", "Option pool (reserved)"' },
    shares: { type: Type.NUMBER },
    pctFullyDiluted: { type: Type.NUMBER },
    evidence: evidenceArraySchema('Rows this cap table entry was read from.'),
  },
  required: ['holder', 'securityClass', 'shares', 'pctFullyDiluted', 'evidence'],
};

const optionGrantGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    grantee: { type: Type.STRING },
    boardApprovalDate: { type: Type.STRING, description: 'YYYY-MM-DD' },
    options: { type: Type.NUMBER },
    strikeUsd: nullable({ type: Type.NUMBER }),
    reflectedInCapTable: nullable({
      type: Type.BOOLEAN,
      description: 'Whether this grant appears to already be counted in the cap table, if determinable from this document alone.',
    }),
    evidence: evidenceArraySchema('Grant rows this entry was read from.'),
  },
  required: ['grantee', 'boardApprovalDate', 'options', 'strikeUsd', 'reflectedInCapTable', 'evidence'],
};

const keyTermGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    label: { type: Type.STRING },
    value: { type: Type.STRING },
    evidence: evidenceArraySchema('Blocks this key term was read from.'),
  },
  required: ['label', 'value', 'evidence'],
};

const extractionResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    workstream: {
      type: Type.STRING,
      format: 'enum',
      enum: WorkstreamSchema.options as unknown as string[],
    },
    confidence: { type: Type.NUMBER, description: '0..1' },
    rationale: { type: Type.STRING, description: 'One sentence.' },
    profile: {
      type: Type.OBJECT,
      properties: {
        name: nullable({ type: Type.STRING }),
        sector: nullable({ type: Type.STRING }),
        hq: nullable({ type: Type.STRING }),
        foundedYear: nullable({ type: Type.INTEGER }),
        employees: nullable({ type: Type.INTEGER }),
        businessSummary: nullable({ type: Type.STRING }),
        financials: { type: Type.ARRAY, items: financialYearGeminiSchema },
        revenueMix: { type: Type.ARRAY, items: revenueMixItemGeminiSchema },
        contracts: { type: Type.ARRAY, items: customerContractGeminiSchema },
        capTable: { type: Type.ARRAY, items: capTableRowGeminiSchema },
        statedFullyDilutedShares: nullable({ type: Type.NUMBER }),
        optionGrants: { type: Type.ARRAY, items: optionGrantGeminiSchema },
        keyTerms: { type: Type.ARRAY, items: keyTermGeminiSchema },
      },
      required: [
        'name',
        'sector',
        'hq',
        'foundedYear',
        'employees',
        'businessSummary',
        'financials',
        'revenueMix',
        'contracts',
        'capTable',
        'statedFullyDilutedShares',
        'optionGrants',
        'keyTerms',
      ],
    },
  },
  required: ['workstream', 'confidence', 'rationale', 'profile'],
};

// ----------------------------------------------------------------------------
// Per-document guidance: which fields a call is responsible for. Every call
// gets the same schema; this just narrows what it should try to fill in, so
// e.g. the contracts document doesn't guess at financials.
// ----------------------------------------------------------------------------

const DOC_RESPONSIBILITY: Record<SourceDocId, string> = {
  'mgmt-pres':
    'company identity (name, sector, hq, foundedYear, employees, a 2-3 sentence businessSummary), the ' +
    'financials table (financials[]), the stated revenue mix (revenueMix[]), and any other notable facts ' +
    'as keyTerms[]. Leave contracts, capTable, and optionGrants empty — this document does not contain them.',
  contracts:
    'the customer contracts (contracts[]) — one entry per contract, reading its term, renewal, and ' +
    'termination provisions carefully. Leave every other field null or empty.',
  'cap-table':
    'the capitalisation table (capTable[]) and the stated fully diluted share count ' +
    '(statedFullyDilutedShares), including the basis stated in any footnote as a keyTerms[] entry. Leave ' +
    'every other field null or empty.',
  options:
    'the option grants (optionGrants[]) — one entry per board-approved grant. Leave every other field ' +
    'null or empty.',
};

function buildExtractionPrompt(doc: SourceDoc): { systemInstruction: string; prompt: string } {
  const systemInstruction =
    'You are a diligence analyst extracting structured facts from one source document as part of an ' +
    'acquisition review. You are careful and literal: extract only what the document states, never what ' +
    'you infer or assume. A fact you cannot find in this document must be null (or omitted from a list), ' +
    'never guessed or estimated. Every extracted value must carry the block id(s) — the bracketed tokens ' +
    'like [s4-b2] — that it was read from, as an evidence entry with a short verbatim quote from that block.';

  const prompt = [
    `Document: ${doc.title} (${doc.kind}).`,
    `Your responsibility in this call: ${DOC_RESPONSIBILITY[doc.id]}`,
    '',
    'Document text, with each block preceded by its bracketed id:',
    renderDocForPrompt(doc),
  ].join('\n');

  return { systemInstruction, prompt };
}

// ----------------------------------------------------------------------------
// One call per document
// ----------------------------------------------------------------------------

interface ExtractDocOutcome {
  docId: SourceDocId;
  ok: boolean;
  model: string;
  classification?: DocClassification;
  slice?: ModelProfileSlice;
  failure?: StageFailure;
}

async function extractOneDoc(doc: SourceDoc): Promise<ExtractDocOutcome> {
  const { systemInstruction, prompt } = buildExtractionPrompt(doc);
  try {
    const { data, model } = await generateJson<ModelExtraction>({
      purpose: `extract:${doc.id}`,
      systemInstruction,
      prompt,
      responseSchema: extractionResponseSchema,
      zodSchema: ModelExtractionSchema,
    });
    return {
      docId: doc.id,
      ok: true,
      model,
      classification: {
        docId: doc.id,
        workstream: data.workstream,
        docKind: doc.kind,
        confidence: data.confidence,
        rationale: data.rationale,
        fieldsExtracted: countFields(data.profile),
      },
      slice: data.profile,
    };
  } catch (err) {
    return {
      docId: doc.id,
      ok: false,
      model: 'none',
      failure: {
        docId: doc.id,
        code: err instanceof LlmTimeoutError ? 'LLM_TIMEOUT' : 'LLM_ERROR',
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

function countFields(slice: ModelProfileSlice): number {
  let n = 0;
  if (slice.name) n++;
  if (slice.sector) n++;
  if (slice.hq) n++;
  if (slice.foundedYear !== null) n++;
  if (slice.employees !== null) n++;
  if (slice.businessSummary) n++;
  if (slice.statedFullyDilutedShares !== null) n++;
  n += slice.financials.length;
  n += slice.revenueMix.length;
  n += slice.contracts.length;
  n += slice.capTable.length;
  n += slice.optionGrants.length;
  n += slice.keyTerms.length;
  return n;
}

// ----------------------------------------------------------------------------
// Deterministic merge — conflicts resolve by document authority: cap table
// wins on shares, contracts win on contract terms, presentation wins on
// narrative (erd.md Part 5 §5.4).
// ----------------------------------------------------------------------------

const toEv = (refs: { docId: SourceDocId; blockId: string; quote: string }[]): EvidenceRef[] => refs.map(toEvidenceRef);

function toFinancialYear(m: z.infer<typeof ModelFinancialYearSchema>): FinancialYear {
  return { ...m, evidence: toEv(m.evidence) };
}
function toRevenueMixItem(m: z.infer<typeof ModelRevenueMixItemSchema>): RevenueMixItem {
  return { ...m, evidence: toEv(m.evidence) };
}
function toCustomerContract(m: z.infer<typeof ModelCustomerContractSchema>): CustomerContract {
  return { ...m, evidence: toEv(m.evidence) };
}
function toCapTableRow(m: z.infer<typeof ModelCapTableRowSchema>): CapTableRow {
  return { ...m, evidence: toEv(m.evidence) };
}
function toOptionGrant(m: z.infer<typeof ModelOptionGrantSchema>): OptionGrant {
  return { ...m, evidence: toEv(m.evidence) };
}
function toKeyTerm(m: z.infer<typeof ModelKeyTermSchema>): KeyTerm {
  return { ...m, evidence: toEv(m.evidence) };
}

function mergeSlices(
  byDoc: Partial<Record<SourceDocId, ModelProfileSlice>>,
): Omit<CompanyProfile, 'statementId' | 'provenance'> {
  const mgmt = byDoc['mgmt-pres'];
  const contracts = byDoc.contracts;
  const capTable = byDoc['cap-table'];
  const options = byDoc.options;

  return {
    name: mgmt?.name ?? '',
    sector: mgmt?.sector ?? '',
    hq: mgmt?.hq ?? null,
    foundedYear: mgmt?.foundedYear ?? null,
    employees: mgmt?.employees ?? null,
    businessSummary: mgmt?.businessSummary ?? '',
    financials: (mgmt?.financials ?? []).map(toFinancialYear),
    revenueMix: (mgmt?.revenueMix ?? []).map(toRevenueMixItem),
    contracts: (contracts?.contracts ?? []).map(toCustomerContract),
    capTable: (capTable?.capTable ?? []).map(toCapTableRow),
    // Cap table wins on shares.
    statedFullyDilutedShares: capTable?.statedFullyDilutedShares ?? mgmt?.statedFullyDilutedShares ?? null,
    optionGrants: (options?.optionGrants ?? []).map(toOptionGrant),
    keyTerms: [
      ...(mgmt?.keyTerms ?? []),
      ...(contracts?.keyTerms ?? []),
      ...(capTable?.keyTerms ?? []),
      ...(options?.keyTerms ?? []),
    ].map(toKeyTerm),
  };
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

// ----------------------------------------------------------------------------
// Entry point
// ----------------------------------------------------------------------------

export async function runExtraction(docsToProcess: SourceDoc[], allDocs: SourceDoc[]): Promise<ExtractionResult> {
  const started = Date.now();

  // extractOneDoc never rejects (it catches its own failures into the
  // outcome), but Promise.allSettled per erd.md §5.4 is the defensive choice
  // in case that ever stops being true.
  const settled = await Promise.allSettled(docsToProcess.map(extractOneDoc));
  const outcomes = settled.map((s, i) =>
    s.status === 'fulfilled'
      ? s.value
      : ({
          docId: docsToProcess[i]!.id,
          ok: false,
          model: 'none',
          failure: {
            docId: docsToProcess[i]!.id,
            code: 'INTERNAL',
            message: s.reason instanceof Error ? s.reason.message : String(s.reason),
          },
        } satisfies ExtractDocOutcome),
  );

  const classifications: DocClassification[] = [];
  const failures: StageFailure[] = [];
  const sliceByDoc: Partial<Record<SourceDocId, ModelProfileSlice>> = {};
  let modelUsed = 'none';

  for (const outcome of outcomes) {
    if (outcome.ok && outcome.classification && outcome.slice) {
      classifications.push(outcome.classification);
      sliceByDoc[outcome.docId] = outcome.slice;
      modelUsed = outcome.model;
    } else if (outcome.failure) {
      failures.push(outcome.failure);
    }
  }

  if (classifications.length === 0) {
    throw new Error('Extraction failed for every document');
  }

  const mergedProfile = mergeSlices(sliceByDoc);

  let droppedEvidenceRefs = 0;
  walkEvidence(mergedProfile, (refs) => {
    const { valid, dropped } = validateEvidence(refs, allDocs, { purpose: 'extract' });
    droppedEvidenceRefs += dropped;
    return valid;
  });

  const statementId = `extract:${nanoid()}:profile`;
  const generatedAt = new Date().toISOString();

  const profile: CompanyProfile = {
    ...mergedProfile,
    statementId,
    provenance: {
      statementId,
      stage: 'extract',
      actor: 'model',
      producedBy: modelUsed,
      promptVersion: null,
      inputHash: sha256Hex(JSON.stringify(docsToProcess.map((d) => d.id))),
      generatedAt,
      latencyMs: Date.now() - started,
    },
  };

  return {
    classifications,
    profile,
    failures,
    droppedEvidenceRefs,
    generatedAt,
  };
}
