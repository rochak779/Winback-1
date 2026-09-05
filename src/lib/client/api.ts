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
  CrosscheckResponseSchema,
  DocsResponseSchema,
  ExtractResponseSchema,
} from '@/lib/contracts/schemas';
import type { ApiError, CompanyProfile, DecisionResult, ExtractionResult, SourceDoc, SourceDocId } from '@/lib/contracts/types';
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

export async function runExtract(dispatch: Dispatch, docIds: SourceDocId[]): Promise<ExtractionResult | null> {
  dispatch({ type: 'STAGE_START', stage: 'extract' });
  try {
    const json = await postJson('/api/extract', { docIds });
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

export async function runCrosscheck(
  dispatch: Dispatch,
  docIds: SourceDocId[],
  profile: CompanyProfile,
): Promise<DecisionResult | null> {
  dispatch({ type: 'STAGE_START', stage: 'decision' });
  try {
    const json = await postJson('/api/crosscheck', { docIds, profile });
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
