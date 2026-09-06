// ============================================================================
// WinBack contract — src/lib/contracts/types.ts
// FROZEN AT HOUR 2. Only Lane D edits this file. See erd.md Part 2 §11.
//
// Every type here is derived from src/lib/contracts/schemas.ts with z.infer,
// so the runtime validation and the compile-time types can never drift.
// The one exception is ApiResponse<T> and the request/response aliases built
// on it: TS generics don't roundtrip through z.infer cleanly, so those are
// hand-written against the same ApiErrorSchema/ApiMetaSchema pieces the zod
// factory (ApiResponseSchema) uses at runtime.
// ============================================================================

import type * as S from './schemas';
import type { z } from 'zod';

// ----------------------------------------------------------------------------
// 3.1 Primitives and evidence
// ----------------------------------------------------------------------------

export type Iso = z.infer<typeof S.IsoSchema>;
export type Workstream = z.infer<typeof S.WorkstreamSchema>;
export type DocKind = z.infer<typeof S.DocKindSchema>;
export type BlockKind = z.infer<typeof S.BlockKindSchema>;
export type SourceDocId = z.infer<typeof S.SourceDocIdSchema>;
export type Block = z.infer<typeof S.BlockSchema>;
export type SourceDoc = z.infer<typeof S.SourceDocSchema>;
export type EvidenceRef = z.infer<typeof S.EvidenceRefSchema>;

// ----------------------------------------------------------------------------
// 3.9 Provenance (defined early — CompanyProfile etc. depend on it)
// ----------------------------------------------------------------------------

export type StatementId = z.infer<typeof S.StatementIdSchema>;
export type Actor = z.infer<typeof S.ActorSchema>;
export type Stage = z.infer<typeof S.StageSchema>;
export type Provenance = z.infer<typeof S.ProvenanceSchema>;

// ----------------------------------------------------------------------------
// 3.2 Deal and profile
// ----------------------------------------------------------------------------

export type Deal = z.infer<typeof S.DealSchema>;
export type FinancialYear = z.infer<typeof S.FinancialYearSchema>;
export type RevenueMixItem = z.infer<typeof S.RevenueMixItemSchema>;
export type CustomerContract = z.infer<typeof S.CustomerContractSchema>;
export type CapTableRow = z.infer<typeof S.CapTableRowSchema>;
export type OptionGrant = z.infer<typeof S.OptionGrantSchema>;
export type KeyTerm = z.infer<typeof S.KeyTermSchema>;
export type CompanyProfile = z.infer<typeof S.CompanyProfileSchema>;

// ----------------------------------------------------------------------------
// 3.3 Extraction
// ----------------------------------------------------------------------------

export type DocClassification = z.infer<typeof S.DocClassificationSchema>;
export type StageFailure = z.infer<typeof S.StageFailureSchema>;
export type ExtractionResult = z.infer<typeof S.ExtractionResultSchema>;

// ----------------------------------------------------------------------------
// 3.4 Benchmark
// ----------------------------------------------------------------------------

export type PeerCompany = z.infer<typeof S.PeerCompanySchema>;
export type BenchmarkMetric = z.infer<typeof S.BenchmarkMetricSchema>;
export type BenchmarkRow = z.infer<typeof S.BenchmarkRowSchema>;
export type BenchmarkResult = z.infer<typeof S.BenchmarkResultSchema>;

// ----------------------------------------------------------------------------
// 3.5 Portfolio impact
// ----------------------------------------------------------------------------

export type PortfolioCompany = z.infer<typeof S.PortfolioCompanySchema>;
export type SectorConcentration = z.infer<typeof S.SectorConcentrationSchema>;
export type PortfolioImpact = z.infer<typeof S.PortfolioImpactSchema>;

// ----------------------------------------------------------------------------
// 3.6 Decision — crosschecks and IC memo
// ----------------------------------------------------------------------------

export type CrosscheckId = z.infer<typeof S.CrosscheckIdSchema>;
export type CrosscheckStatus = z.infer<typeof S.CrosscheckStatusSchema>;
export type Crosscheck = z.infer<typeof S.CrosscheckSchema>;
export type ComingSoonWorkstream = z.infer<typeof S.ComingSoonWorkstreamSchema>;
export type DecisionResult = z.infer<typeof S.DecisionResultSchema>;
export type MemoSectionId = z.infer<typeof S.MemoSectionIdSchema>;
export type MemoSection = z.infer<typeof S.MemoSectionSchema>;
export type IcMemo = z.infer<typeof S.IcMemoSchema>;

// ----------------------------------------------------------------------------
// 3.7 Run state (client-side)
// ----------------------------------------------------------------------------

export type StageStatus = z.infer<typeof S.StageStatusSchema>;
export type StageState = z.infer<typeof S.StageStateSchema>;
export type Run = z.infer<typeof S.RunSchema>;

// ----------------------------------------------------------------------------
// 3.8 API envelope
// ----------------------------------------------------------------------------

export type ErrorCode = z.infer<typeof S.ErrorCodeSchema>;
export type ApiError = z.infer<typeof S.ApiErrorSchema>;
export type ApiMeta = z.infer<typeof S.ApiMetaSchema>;

/** Hand-written generic — see file header for why this isn't z.infer'd. */
export type ApiResponse<T> = { ok: true; data: T; meta: ApiMeta } | { ok: false; error: ApiError };

// --- Request bodies ----------------------------------------------------------
export type ExtractRequest = z.infer<typeof S.ExtractRequestSchema>;
export type BenchmarkRequest = z.infer<typeof S.BenchmarkRequestSchema>;
export type PortfolioRequest = z.infer<typeof S.PortfolioRequestSchema>;
export type CrosscheckRequest = z.infer<typeof S.CrosscheckRequestSchema>;
export type MemoRequest = z.infer<typeof S.MemoRequestSchema>;

// --- Response payloads --------------------------------------------------------
export type DocsResponse = ApiResponse<{ docs: SourceDoc[] }>;
export type ExtractResponse = ApiResponse<ExtractionResult>;
export type BenchmarkResponse = ApiResponse<BenchmarkResult>;
export type PortfolioResponse = ApiResponse<PortfolioImpact>;
export type CrosscheckResponse = ApiResponse<DecisionResult>;
export type MemoResponse = ApiResponse<IcMemo>;

// ----------------------------------------------------------------------------
// 3.9 Audit trail
// ----------------------------------------------------------------------------

export type AuditAction = z.infer<typeof S.AuditActionSchema>;
export type AuditEntry = z.infer<typeof S.AuditEntrySchema>;
export type AuditClientAction = z.infer<typeof S.AuditClientActionSchema>;
export type AuditEventRequest = z.infer<typeof S.AuditEventRequestSchema>;
export type AuditListResponse = z.infer<typeof S.AuditListResponseSchema>;

// ----------------------------------------------------------------------------
// 3.10 Knowledge graph
// ----------------------------------------------------------------------------

export type NodeType = z.infer<typeof S.NodeTypeSchema>;
export type EdgeType = z.infer<typeof S.EdgeTypeSchema>;
export type GraphNode = z.infer<typeof S.GraphNodeSchema>;
export type GraphEdge = z.infer<typeof S.GraphEdgeSchema>;
export type KnowledgeGraph = z.infer<typeof S.KnowledgeGraphSchema>;
