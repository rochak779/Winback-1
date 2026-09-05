// ============================================================================
// src/lib/pipeline/http.ts
//
// Shared shape for every API route (erd.md Part 2 §5). Auth and rate
// limiting are Lane D / Phase 6 work (explicitly deferred at session 0.3 —
// "skip Firebase Auth and Firestore for now") and aren't wired in yet; the
// envelope, zod validation, and error handling are.
// ============================================================================

import { NextResponse } from 'next/server';
import { z, type ZodType } from 'zod';
import type { ApiError, ApiMeta, ErrorCode } from '@/lib/contracts/types';
import { checkRateLimit, RateLimitError } from '@/lib/ratelimit';

function statusForCode(code: ErrorCode): number {
  switch (code) {
    case 'BAD_REQUEST':
      return 400;
    case 'UNAUTHORIZED':
      return 401;
    case 'RATE_LIMITED':
      return 429;
    case 'LLM_TIMEOUT':
      return 504;
    case 'LLM_ERROR':
      return 502;
    case 'CONTRACT_VIOLATION':
    case 'INTERNAL':
      return 500;
  }
}

export function apiError(code: ErrorCode, message: string, details?: unknown, retryAfterSec?: number): NextResponse {
  const body: { ok: false; error: ApiError } = { ok: false, error: { code, message, details, retryAfterSec } };
  const headers = retryAfterSec ? { 'Retry-After': String(retryAfterSec) } : undefined;
  return NextResponse.json(body, { status: statusForCode(code), headers });
}

export function apiSuccess<T>(data: T, meta: ApiMeta, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data, meta }, { status });
}

export type ParsedBody<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/** Parses and validates a request body against the route's zod schema. */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<ParsedBody<T>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return { ok: false, response: apiError('BAD_REQUEST', 'Request body must be valid JSON') };
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    return {
      ok: false,
      response: apiError('BAD_REQUEST', 'Request body failed validation', z.flattenError(result.error)),
    };
  }
  return { ok: true, data: result.data };
}

/**
 * Validates our own response before it leaves the server — a failure here is
 * our bug, never the caller's, so it's a 500 CONTRACT_VIOLATION rather than a
 * 400. Never ship malformed data to the UI.
 */
export function validateOwnOutput<T>(schema: ZodType<T>, data: T): NextResponse | null {
  const result = schema.safeParse(data);
  if (result.success) return null;
  console.error('[winback] CONTRACT_VIOLATION', z.flattenError(result.error));
  return apiError('CONTRACT_VIOLATION', 'Server produced a response that failed its own schema');
}

/** Wraps a route handler with the standard try/catch → INTERNAL error envelope, and applies rate limiting. */
export async function withRoute(req: Request, routeName: string, type: 'llm' | 'standard', handler: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'anonymous';
    await checkRateLimit(ip, type);
    return await handler();
  } catch (err: unknown) {
    if (err instanceof RateLimitError) {
      return apiError('RATE_LIMITED', err.message, undefined, err.retryAfterSec);
    }
    console.error('[winback]', routeName, err);
    return apiError('INTERNAL', 'An unexpected error occurred');
  }
}
