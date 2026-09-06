// ============================================================================
// src/lib/client/api.ts — erd.md Part 2 §8, §6.1
//
// The only place in the UI layer that calls `fetch`. Every function
// dispatches STAGE_START before the request and STAGE_SUCCESS/STAGE_ERROR
// after, validating the response with the same zod schemas the server uses
// — a screen component never touches `fetch` or trusts an unvalidated
// response.
// ============================================================================

import {
  AuditEventResponseSchema,
  BenchmarkResponseSchema,
  CrosscheckResponseSchema,
  DocsResponseSchema,
  ExtractResponseSchema,
  MemoResponseSchema,
  PortfolioResponseSchema,
} from '@/lib/contracts/schemas';
import type {
  ApiError,
  AuditClientAction,
  BenchmarkResult,
  CompanyProfile,
  Crosscheck,
  Deal,
  DecisionResult,
  ExtractionResult,
  IcMemo,
  PortfolioImpact,
  SourceDoc,
  SourceDocId,
  Stage,
} from '@/lib/contracts/types';
import type { RunAction } from '@/lib/store/RunProvider';

type Dispatch = (action: RunAction) => void;

const NETWORK_ERROR: ApiError = {
  code: 'INTERNAL',
  message: 'Could not reach the server — check your connection and retry.',
};

const CONTRACT_ERROR: ApiError = {
  code: 'CONTRACT_VIOLATION',
  message: 'The server returned a response that failed validation.',
};

async function postJson(url: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

/** GET /api/docs. Not a pipeline "stage" (erd.md §3.7 only tracks extract/benchmark/portfolio/decision/memo), so failures are reported to the caller rather than dispatched. */
export async function fetchDocs(dispatch: Dispatch): Promise<SourceDoc[] | null> {
  try {
    const res = await fetch('/api/docs');
    const json = await res.json();
    const parsed = DocsResponseSchema.safeParse(json);
    if (!parsed.success || !parsed.data.ok) return null;
    dispatch({ type: 'SET_DOCS', docs: parsed.data.data.docs });
    return parsed.data.data.docs;
  } catch {
    return null;
  }
}

export async function runExtract(dispatch: Dispatch, runId: string, docIds: SourceDocId[]): Promise<ExtractionResult | null> {
  dispatch({ type: 'STAGE_START', stage: 'extract' });
  try {
    const json = await postJson('/api/extract', { runId, docIds });
    const parsed = ExtractResponseSchema.safeParse(json);
    if (!parsed.success) {
      dispatch({ type: 'STAGE_ERROR', stage: 'extract', error: CONTRACT_ERROR });
      return null;
    }
    if (!parsed.data.ok) {
      dispatch({ type: 'STAGE_ERROR', stage: 'extract', error: parsed.data.error });
      return null;
    }
    dispatch({ type: 'STAGE_SUCCESS', stage: 'extract', payload: parsed.data.data, meta: parsed.data.meta });
    return parsed.data.data;
  } catch {
    dispatch({ type: 'STAGE_ERROR', stage: 'extract', error: NETWORK_ERROR });
    return null;
  }
}

export async function runBenchmark(dispatch: Dispatch, runId: string, profile: CompanyProfile): Promise<BenchmarkResult | null> {
  dispatch({ type: 'STAGE_START', stage: 'benchmark' });
  try {
    const json = await postJson('/api/benchmark', { runId, profile });
    const parsed = BenchmarkResponseSchema.safeParse(json);
    if (!parsed.success) {
      dispatch({ type: 'STAGE_ERROR', stage: 'benchmark', error: CONTRACT_ERROR });
      return null;
    }
    if (!parsed.data.ok) {
      dispatch({ type: 'STAGE_ERROR', stage: 'benchmark', error: parsed.data.error });
      return null;
    }
    dispatch({ type: 'STAGE_SUCCESS', stage: 'benchmark', payload: parsed.data.data, meta: parsed.data.meta });
    return parsed.data.data;
  } catch {
    dispatch({ type: 'STAGE_ERROR', stage: 'benchmark', error: NETWORK_ERROR });
    return null;
  }
}

export async function runPortfolio(
  dispatch: Dispatch,
  runId: string,
  profile: CompanyProfile,
  dealSizeUsdM: number,
): Promise<PortfolioImpact | null> {
  dispatch({ type: 'STAGE_START', stage: 'portfolio' });
  try {
    const json = await postJson('/api/portfolio', { runId, profile, dealSizeUsdM });
    const parsed = PortfolioResponseSchema.safeParse(json);
    if (!parsed.success) {
      dispatch({ type: 'STAGE_ERROR', stage: 'portfolio', error: CONTRACT_ERROR });
      return null;
    }
    if (!parsed.data.ok) {
      dispatch({ type: 'STAGE_ERROR', stage: 'portfolio', error: parsed.data.error });
      return null;
    }
    dispatch({ type: 'STAGE_SUCCESS', stage: 'portfolio', payload: parsed.data.data, meta: parsed.data.meta });
    return parsed.data.data;
  } catch {
    dispatch({ type: 'STAGE_ERROR', stage: 'portfolio', error: NETWORK_ERROR });
    return null;
  }
}

export async function runCrosscheck(
  dispatch: Dispatch,
  runId: string,
  docIds: SourceDocId[],
  profile: CompanyProfile,
): Promise<DecisionResult | null> {
  dispatch({ type: 'STAGE_START', stage: 'decision' });
  try {
    const json = await postJson('/api/crosscheck', { runId, docIds, profile });
    const parsed = CrosscheckResponseSchema.safeParse(json);
    if (!parsed.success) {
      dispatch({ type: 'STAGE_ERROR', stage: 'decision', error: CONTRACT_ERROR });
      return null;
    }
    if (!parsed.data.ok) {
      dispatch({ type: 'STAGE_ERROR', stage: 'decision', error: parsed.data.error });
      return null;
    }
    dispatch({ type: 'STAGE_SUCCESS', stage: 'decision', payload: parsed.data.data, meta: parsed.data.meta });
    return parsed.data.data;
  } catch {
    dispatch({ type: 'STAGE_ERROR', stage: 'decision', error: NETWORK_ERROR });
    return null;
  }
}

export async function runMemo(
  dispatch: Dispatch,
  runId: string,
  deal: Deal,
  profile: CompanyProfile,
  benchmark: BenchmarkResult,
  portfolio: PortfolioImpact,
  crosschecks: Crosscheck[],
): Promise<IcMemo | null> {
  dispatch({ type: 'STAGE_START', stage: 'memo' });
  try {
    const json = await postJson('/api/memo', { runId, deal, profile, benchmark, portfolio, crosschecks });
    const parsed = MemoResponseSchema.safeParse(json);
    if (!parsed.success) {
      dispatch({ type: 'STAGE_ERROR', stage: 'memo', error: CONTRACT_ERROR });
      return null;
    }
    if (!parsed.data.ok) {
      dispatch({ type: 'STAGE_ERROR', stage: 'memo', error: parsed.data.error });
      return null;
    }
    dispatch({ type: 'STAGE_SUCCESS', stage: 'memo', payload: parsed.data.data, meta: parsed.data.meta });
    return parsed.data.data;
  } catch {
    dispatch({ type: 'STAGE_ERROR', stage: 'memo', error: NETWORK_ERROR });
    return null;
  }
}

/**
 * Fire-and-forget from the caller's perspective — never awaited, never
 * throws into the UI. Records an analyst action or a "viewed an old run"
 * event (erd.md Part 9.1 Guarantee 2's client-originated half).
 */
export function recordAuditEvent(input: {
  runId: string;
  action: AuditClientAction;
  stage?: Stage | null;
  statementId?: string | null;
  statementText?: string | null;
  before?: string | null;
  after?: string | null;
  note?: string | null;
}): void {
  void (async () => {
    try {
      const json = await postJson('/api/audit/event', input);
      AuditEventResponseSchema.safeParse(json); // best-effort only — nothing depends on the shape here
    } catch {
      // Never surfaced to the UI — see file header on runExtract et al. for why
      // this pattern is safe: it's advisory, not part of the pipeline contract.
    }
  })();
}
