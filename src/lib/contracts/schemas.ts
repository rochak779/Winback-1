// ============================================================================
// WinBack contract — src/lib/contracts/schemas.ts
// FROZEN AT HOUR 2. Only Lane D edits this file. See erd.md Part 2 §11.
//
// This is the single source of truth for every shape crossing a lane
// boundary. src/lib/contracts/types.ts derives its TypeScript types from
// these zod schemas with z.infer, so the two can never drift.
//
// Mirrors erd.md Part 3 in full, including the §3.9 provenance/audit
// additions to CompanyProfile, BenchmarkResult, PortfolioImpact, Crosscheck,
// and MemoSection, and the §3.10 knowledge-graph types.
// ============================================================================

import { z } from 'zod';

// ----------------------------------------------------------------------------
// 3.1 Primitives and evidence
// ----------------------------------------------------------------------------

/** ISO-8601 timestamp string. */
export const IsoSchema = z.string();

export const WorkstreamSchema = z.enum([
  'financial',
  'commercial',
  'legal',
  'tax',
  'hr',
  'operations',
  'unknown',
]);

export const DocKindSchema = z.enum([
  'management_presentation',
  'customer_contracts',
  'cap_table',
  'option_grants',
]);

export const BlockKindSchema = z.enum([
  'heading',
  'paragraph',
  'bullet',
  'kv', // a label/value pair, e.g. "FY24 Revenue: $42.1m"
  'table',
  'clause', // a numbered contract clause
]);

/** Closed union of the four documents in this build. Adding a fifth is a contract change. */
export const SourceDocIdSchema = z.enum(['mgmt-pres', 'contracts', 'cap-table', 'options']);

/**
 * One addressable unit of a source document. THE atom of traceability.
 * `id` is unique within its document and NEVER changes after Hour 6.
 */
export const BlockSchema = z.object({
  id: z.string(), // e.g. 's4-b2', 'c3-cl7', 'row-12', 'g5'
  kind: BlockKindSchema,
  text: z.string(), // plain text; for tables, a readable flattening
  page: z.number(), // 1-indexed. Slide number for the presentation.
  section: z.string().optional(), // human label, e.g. 'Revenue Quality'
  table: z
    .object({
      columns: z.array(z.string()),
      rows: z.array(z.array(z.string())),
    })
    .optional(),
  deprecated: z.boolean().optional(), // set instead of deleting a block after Hour 6
});

export const SourceDocSchema = z.object({
  id: SourceDocIdSchema,
  kind: DocKindSchema,
  title: z.string(), // 'Project Meridian — Management Presentation'
  filename: z.string(), // cosmetic only
  dateLabel: z.string(), // 'March 2026'
  pages: z.number(),
  pageNoun: z.enum(['slide', 'page', 'row', 'grant']), // how the UI labels a page ref
  blocks: z.array(BlockSchema),
});

/** A pointer from any generated statement back to the document it came from. */
export const EvidenceRefSchema = z.object({
  docId: SourceDocIdSchema,
  blockId: z.string(),
  page: z.number(),
  quote: z.string(), // verbatim substring of the block's text
  quoteVerified: z.boolean(), // set server-side by validateEvidence()
  note: z.string().optional(), // optional one-line "why this matters"
});

// ----------------------------------------------------------------------------
// 3.9 Provenance and audit trail (defined early — CompanyProfile etc. need it)
// ----------------------------------------------------------------------------

/** Stable id for one generated assertion. Format: '<sessionId>:<stage>:<slug>'. */
export const StatementIdSchema = z.string();

export const ActorSchema = z.enum(['system', 'model', 'analyst']);

export const StageSchema = z.enum(['extract', 'benchmark', 'portfolio', 'decision', 'memo']);

export const ProvenanceSchema = z.object({
  statementId: StatementIdSchema,
  stage: StageSchema,
  actor: ActorSchema,
  /** 'gemini-2.5-pro' for model output; 'deterministic' for TypeScript-computed values. */
  producedBy: z.string(),
  promptVersion: z.string().nullable(), // e.g. 'crosscheck-recurring@v4'; null when deterministic
  inputHash: z.string(), // sha256 of the exact inputs — makes a run reproducible
  generatedAt: IsoSchema,
  latencyMs: z.number().nullable(),
});

// ----------------------------------------------------------------------------
// 3.2 Deal and profile
// ----------------------------------------------------------------------------

export const DealSchema = z.object({
  id: z.string(), // nanoid, created client-side
  name: z.string(), // 'Project Meridian'
  targetCompany: z.string(), // 'Meridian Health Partners'
  sector: z.string(), // must match sector strings in peers.ts / portfolio.ts
  thesis: z.string(), // free text from the Plan screen
  dealSizeUsdM: z.number(), // enterprise value in USD millions
  createdAt: IsoSchema,
});

export const FinancialYearSchema = z.object({
  fy: z.string(), // 'FY24'
  revenueUsdM: z.number(),
  revenueGrowthPct: z.number().nullable(), // null for the earliest year
  grossMarginPct: z.number().nullable(),
  ebitdaUsdM: z.number().nullable(),
  ebitdaMarginPct: z.number().nullable(),
  evidence: z.array(EvidenceRefSchema),
});

export const RevenueMixItemSchema = z.object({
  label: z.string(), // 'Recurring / subscription', 'Project-based'
  pct: z.number(),
  evidence: z.array(EvidenceRefSchema),
});

export const CustomerContractSchema = z.object({
  customer: z.string(),
  annualValueUsdM: z.number(),
  startDate: z.string(), // 'YYYY-MM-DD' or 'YYYY-MM'
  termMonths: z.number().nullable(),
  autoRenew: z.boolean().nullable(),
  cancellationNoticeDays: z.number().nullable(),
  cancellationForConvenience: z.boolean().nullable(), // the crosscheck-1 hinge
  classifiedAsRecurringByMgmt: z.boolean().nullable(),
  evidence: z.array(EvidenceRefSchema),
});

export const CapTableRowSchema = z.object({
  holder: z.string(),
  securityClass: z.string(), // 'Common', 'Series A Preferred', 'Option pool (reserved)'
  shares: z.number(),
  pctFullyDiluted: z.number(), // as stated in the document
  evidence: z.array(EvidenceRefSchema),
});

export const OptionGrantSchema = z.object({
  grantee: z.string(),
  boardApprovalDate: z.string(), // 'YYYY-MM-DD'
  options: z.number(),
  strikeUsd: z.number().nullable(),
  reflectedInCapTable: z.boolean().nullable(), // the crosscheck-2 hinge; null = model unsure
  evidence: z.array(EvidenceRefSchema),
});

export const KeyTermSchema = z.object({
  label: z.string(),
  value: z.string(),
  evidence: z.array(EvidenceRefSchema),
});

export const CompanyProfileSchema = z.object({
  name: z.string(),
  sector: z.string(),
  hq: z.string().nullable(),
  foundedYear: z.number().nullable(),
  employees: z.number().nullable(),
  businessSummary: z.string(), // 2–3 sentences
  financials: z.array(FinancialYearSchema), // newest last
  revenueMix: z.array(RevenueMixItemSchema),
  contracts: z.array(CustomerContractSchema),
  capTable: z.array(CapTableRowSchema),
  statedFullyDilutedShares: z.number().nullable(),
  optionGrants: z.array(OptionGrantSchema),
  keyTerms: z.array(KeyTermSchema),
  // --- §3.9 addition, frozen at Hour 2 ---
  statementId: StatementIdSchema,
  provenance: ProvenanceSchema,
});

// ----------------------------------------------------------------------------
// 3.3 Extraction
// ----------------------------------------------------------------------------

export const DocClassificationSchema = z.object({
  docId: SourceDocIdSchema,
  workstream: WorkstreamSchema,
  docKind: DocKindSchema,
  confidence: z.number(), // 0..1
  rationale: z.string(), // one sentence
  fieldsExtracted: z.number(), // how many profile fields this doc contributed
});

export const StageFailureSchema = z.object({
  docId: SourceDocIdSchema.optional(),
  code: z.string(),
  message: z.string(),
});

export const ExtractionResultSchema = z.object({
  classifications: z.array(DocClassificationSchema),
  profile: CompanyProfileSchema,
  failures: z.array(StageFailureSchema),
  droppedEvidenceRefs: z.number(),
  generatedAt: IsoSchema,
});

// ----------------------------------------------------------------------------
// 3.4 Benchmark
// ----------------------------------------------------------------------------

export const PeerCompanySchema = z.object({
  id: z.string(),
  name: z.string(),
  sector: z.string(),
  revenueUsdM: z.number(),
  revenueGrowthPct: z.number(),
  grossMarginPct: z.number(),
  evEbitdaMultiple: z.number(),
  descriptor: z.string(), // one line, so the UI can explain why it's a fair comp
});

export const BenchmarkMetricSchema = z.enum([
  'revenue_growth_pct',
  'gross_margin_pct',
  'ev_ebitda_multiple',
]);

export const BenchmarkRowSchema = z.object({
  metric: BenchmarkMetricSchema,
  label: z.string(), // 'Revenue growth'
  unit: z.enum(['%', 'x']),
  targetValue: z.number().nullable(), // null if extraction couldn't determine it
  targetEvidence: z.array(EvidenceRefSchema),
  peerValues: z.array(z.object({ peerId: z.string(), value: z.number() })),
  peerMedian: z.number(),
  deltaVsMedian: z.number().nullable(), // targetValue - peerMedian
  direction: z.enum(['above', 'below', 'inline', 'unknown']), // 'inline' = within ±1 unit
});

export const BenchmarkResultSchema = z.object({
  peers: z.array(PeerCompanySchema),
  rows: z.array(BenchmarkRowSchema),
  commentary: z.string().nullable(), // LLM prose; null when degraded
  degraded: z.boolean(),
  generatedAt: IsoSchema,
  // --- §3.9 addition, frozen at Hour 2 ---
  statementId: StatementIdSchema,
  provenance: ProvenanceSchema,
});

// `direction` is descriptive, not evaluative — no copy anywhere says "good" or "bad" (Part 1, Rule 3).

// ----------------------------------------------------------------------------
// 3.5 Portfolio impact
// ----------------------------------------------------------------------------

export const PortfolioCompanySchema = z.object({
  id: z.string(),
  name: z.string(),
  sector: z.string(),
  dealSizeUsdM: z.number(),
  vintageYear: z.number(),
});

export const SectorConcentrationSchema = z.object({
  sector: z.string(),
  beforeUsdM: z.number(),
  afterUsdM: z.number(),
  beforePct: z.number(), // 1 decimal
  afterPct: z.number(), // 1 decimal
  deltaPct: z.number(), // afterPct - beforePct, 1 decimal
  isTargetSector: z.boolean(),
});

export const PortfolioImpactSchema = z.object({
  portfolio: z.array(PortfolioCompanySchema),
  targetSector: z.string(),
  targetDealSizeUsdM: z.number(),
  totalBeforeUsdM: z.number(),
  totalAfterUsdM: z.number(),
  concentrations: z.array(SectorConcentrationSchema), // sorted by afterPct desc
  headline: z.string().nullable(), // LLM, one sentence; null when degraded
  degraded: z.boolean(),
  generatedAt: IsoSchema,
  // --- §3.9 addition, frozen at Hour 2 ---
  statementId: StatementIdSchema,
  provenance: ProvenanceSchema,
});

// ----------------------------------------------------------------------------
// 3.6 Decision — crosschecks and IC memo
// ----------------------------------------------------------------------------

export const CrosscheckIdSchema = z.enum(['recurring_revenue', 'option_dilution']);

export const CrosscheckStatusSchema = z.enum(['contradiction_found', 'consistent', 'inconclusive']);

export const CrosscheckSchema = z.object({
  id: CrosscheckIdSchema,
  title: z.string(), // 'Recurring revenue characterisation'
  workstream: WorkstreamSchema,
  status: CrosscheckStatusSchema,
  /** What management asserted, and where. */
  claim: z.object({
    text: z.string(),
    evidence: z.array(EvidenceRefSchema),
  }),
  /** What the underlying records show. Empty when status is 'consistent'. */
  counterEvidence: z.array(EvidenceRefSchema),
  /** 2–4 sentences explaining the gap in plain language. No verdict. */
  explanation: z.string(),
  /** The numeric shape of the gap, when there is one. */
  quantification: z
    .object({
      label: z.string(), // 'Revenue characterised as recurring'
      claimedValue: z.number(),
      observedValue: z.number(),
      unit: z.enum(['%', 'x', 'shares', 'USDm']),
      note: z.string(), // how observedValue was derived
    })
    .nullable(),
  /** A HINT for the analyst. Never rendered as a determination. */
  severityHint: z.enum(['high', 'medium', 'low']),
  /** Neutral, IC-ready sentence the analyst can paste or edit. */
  suggestedMemoLanguage: z.string(),
  modelConfidence: z.number(), // 0..1
  // --- §3.9 additions, frozen at Hour 2 ---
  statementId: StatementIdSchema,
  provenance: ProvenanceSchema,
  analystDecision: z.enum(['pending', 'accepted', 'dismissed']),
  analystNote: z.string().nullable(),
});

export const ComingSoonWorkstreamSchema = z.object({
  workstream: WorkstreamSchema,
  label: z.string(), // 'Legal & regulatory'
  description: z.string(), // one line
});

export const DecisionResultSchema = z.object({
  crosschecks: z.array(CrosscheckSchema),
  comingSoon: z.array(ComingSoonWorkstreamSchema),
  failures: z.array(StageFailureSchema),
  generatedAt: IsoSchema,
});

export const MemoSectionIdSchema = z.enum([
  'situation',
  'numbers',
  'portfolio_fit',
  'requires_confirmation',
  'next_steps',
]);

export const MemoSectionSchema = z.object({
  id: MemoSectionIdSchema,
  heading: z.string(),
  body: z.string(), // markdown-lite: paragraphs and '- ' bullets only
  evidence: z.array(EvidenceRefSchema),
  // --- §3.9 additions, frozen at Hour 2 ---
  statementId: StatementIdSchema,
  provenance: ProvenanceSchema,
  edited: z.boolean(),
  originalBody: z.string().nullable(),
});

export const IcMemoSchema = z.object({
  dealName: z.string(),
  targetCompany: z.string(),
  thesis: z.string(),
  sections: z.array(MemoSectionSchema),
  disclaimer: z.string(), // fixed string; see Part 5 §7
  generatedAt: IsoSchema,
  status: z.enum(['draft', 'analyst_edited', 'approved']),
});

// ----------------------------------------------------------------------------
// 3.7 Run state (client-side)
// ----------------------------------------------------------------------------

export const StageStatusSchema = z.enum(['idle', 'running', 'done', 'error']);

// ----------------------------------------------------------------------------
// 3.8 API envelope (ApiError/ApiMeta must exist before StageState uses ApiError)
// ----------------------------------------------------------------------------

export const ErrorCodeSchema = z.enum([
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'RATE_LIMITED',
  'LLM_ERROR',
  'LLM_TIMEOUT',
  'CONTRACT_VIOLATION',
  'INTERNAL',
]);

export const ApiErrorSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string(), // safe to render to a user
  details: z.unknown().optional(), // dev only
  retryAfterSec: z.number().optional(),
});

export const ApiMetaSchema = z.object({
  ms: z.number(),
  model: z.string(),
  mock: z.boolean(),
  droppedEvidenceRefs: z.number().optional(),
});

/**
 * ApiResponse<T> is generic, so it's expressed as a schema factory rather
 * than a single static schema. Instantiate per response payload below.
 */
export function ApiResponseSchema<T extends z.ZodType>(data: T) {
  return z.union([
    z.object({ ok: z.literal(true), data, meta: ApiMetaSchema }),
    z.object({ ok: z.literal(false), error: ApiErrorSchema }),
  ]);
}

export const StageStateSchema = z.object({
  status: StageStatusSchema,
  error: ApiErrorSchema.nullable(),
  startedAt: IsoSchema.nullable(),
  finishedAt: IsoSchema.nullable(),
  mock: z.boolean(),
});

export const RunSchema = z.object({
  id: z.string(),
  deal: DealSchema.nullable(),
  docs: z.array(SourceDocSchema),
  extraction: ExtractionResultSchema.nullable(),
  benchmark: BenchmarkResultSchema.nullable(),
  portfolio: PortfolioImpactSchema.nullable(),
  decision: DecisionResultSchema.nullable(),
  memo: IcMemoSchema.nullable(),
  stages: z.object({
    extract: StageStateSchema,
    benchmark: StageStateSchema,
    portfolio: StageStateSchema,
    decision: StageStateSchema,
    memo: StageStateSchema,
  }),
  createdAt: IsoSchema,
  version: z.literal(1), // bump if the localStorage shape changes
});

// --- Request bodies ---------------------------------------------------------

export const ExtractRequestSchema = z.object({ docIds: z.array(SourceDocIdSchema) });
export const BenchmarkRequestSchema = z.object({ profile: CompanyProfileSchema });
export const PortfolioRequestSchema = z.object({
  profile: CompanyProfileSchema,
  dealSizeUsdM: z.number(),
});
export const CrosscheckRequestSchema = z.object({
  docIds: z.array(SourceDocIdSchema),
  profile: CompanyProfileSchema,
});
export const MemoRequestSchema = z.object({
  deal: DealSchema,
  profile: CompanyProfileSchema,
  benchmark: BenchmarkResultSchema,
  portfolio: PortfolioImpactSchema,
  crosschecks: z.array(CrosscheckSchema),
});

// --- Response payloads -------------------------------------------------------

export const DocsResponseSchema = ApiResponseSchema(z.object({ docs: z.array(SourceDocSchema) }));
export const ExtractResponseSchema = ApiResponseSchema(ExtractionResultSchema);
export const BenchmarkResponseSchema = ApiResponseSchema(BenchmarkResultSchema);
export const PortfolioResponseSchema = ApiResponseSchema(PortfolioImpactSchema);
export const CrosscheckResponseSchema = ApiResponseSchema(DecisionResultSchema);
export const MemoResponseSchema = ApiResponseSchema(IcMemoSchema);

// ----------------------------------------------------------------------------
// 3.9 Audit trail (Provenance/Actor/StatementId/Stage defined above)
// ----------------------------------------------------------------------------

export const AuditActionSchema = z.enum([
  'stage_started',
  'stage_completed',
  'stage_failed',
  'statement_generated',
  'evidence_dropped',
  'analyst_accepted',
  'analyst_dismissed',
  'analyst_edited',
  'memo_status_changed',
  'session_created',
  'session_viewed',
  'session_deleted',
]);

export const AuditEntrySchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  userId: z.string(),
  at: IsoSchema,
  actor: ActorSchema,
  action: AuditActionSchema,
  stage: StageSchema.nullable(),
  statementId: StatementIdSchema.nullable(),
  /** The assertion as rendered, verbatim, at the moment it was recorded. */
  statementText: z.string().nullable(),
  evidence: z.array(EvidenceRefSchema),
  provenance: ProvenanceSchema.nullable(),
  /** For analyst_edited: what changed. */
  before: z.string().nullable(),
  after: z.string().nullable(),
  note: z.string().nullable(),
});

// ----------------------------------------------------------------------------
// 3.10 Knowledge graph — a projection of data that already exists.
// No new extraction, no new model calls.
// ----------------------------------------------------------------------------

export const NodeTypeSchema = z.enum([
  'deal',
  'company', // the target, and peers, and portfolio companies
  'sector',
  'document',
  'block', // an evidence-bearing block
  'entity', // a customer, a shareholder, an option grantee
  'metric',
  'finding', // a crosscheck
  'memo_section',
  'thesis',
]);

export const EdgeTypeSchema = z.enum([
  'belongs_to', // block → document, document → deal
  'cites', // finding/memo_section → block
  'contradicts', // claim block → counter-evidence block
  'mentions', // block → entity
  'counterparty_of', // entity → company
  'compares_to', // target → peer
  'same_sector', // company → sector
  'held_in', // company → portfolio (via deal)
  'derived_from', // metric → block
  'supports', // memo_section → finding
]);

const MetaValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const GraphNodeSchema = z.object({
  id: z.string(), // 'block:mgmt-pres#s4-b2', 'entity:northgate-health'
  type: NodeTypeSchema,
  label: z.string(),
  sessionId: z.string().nullable(), // null for cross-session nodes (sectors, shared entities)
  /** Where clicking this node takes you. */
  href: z.string().nullable(),
  evidence: EvidenceRefSchema.nullable(),
  /** Drives node size. Degree by default; findings and the deal get a floor. */
  weight: z.number(),
  /** Set on nodes involved in a contradiction — the graph's focal points. */
  flagged: z.boolean(),
  meta: z.record(z.string(), MetaValueSchema),
});

export const GraphEdgeSchema = z.object({
  id: z.string(),
  source: z.string(), // GraphNode.id
  target: z.string(),
  type: EdgeTypeSchema,
  weight: z.number(),
  label: z.string().nullable(),
});

export const KnowledgeGraphSchema = z.object({
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
  sessionIds: z.array(z.string()), // which sessions contributed
  generatedAt: IsoSchema,
  stats: z.object({
    nodeCount: z.number(),
    edgeCount: z.number(),
    sessionCount: z.number(),
    contradictionCount: z.number(),
    sharedEntityCount: z.number(), // entities in >1 session — the whole point
  }),
});
