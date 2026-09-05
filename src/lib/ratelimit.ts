// ============================================================================
// src/lib/ratelimit.ts — erd.md Part 2 §14
//
// Rate limiting and cost control for the LLM routes. This is an in-memory
// fallback for Phase 5. Phase 6 will use Firestore if available.
// ============================================================================

import type { ErrorCode } from '@/lib/contracts/types';

export class RateLimitError extends Error {
  code: ErrorCode = 'RATE_LIMITED';
  retryAfterSec?: number;
  constructor(message: string, retryAfterSec?: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterSec = retryAfterSec;
  }
}

interface LimitConfig {
  maxRequests: number;
  windowMs: number;
}

const LLM_LIMIT: LimitConfig = { maxRequests: 10, windowMs: 10 * 60 * 1000 }; // 10 per 10 mins
const STANDARD_LIMIT: LimitConfig = { maxRequests: 60, windowMs: 60 * 1000 }; // 60 per 1 min

// In-memory store (ephemeral, resets on cold start, sufficient for hackathon local dev/early deployment)
const memoryStore = new Map<string, number[]>();
let globalLlmCalls = 0;

export async function checkRateLimit(
  userIdOrIp: string,
  type: 'llm' | 'standard'
): Promise<void> {
  const config = type === 'llm' ? LLM_LIMIT : STANDARD_LIMIT;
  const now = Date.now();

  // Check global LLM budget first
  if (type === 'llm') {
    const budgetMax = parseInt(process.env.RUN_BUDGET_MAX ?? '500', 10);
    if (globalLlmCalls >= budgetMax) {
      throw new RateLimitError(
        'Demo quota reached — see the recorded walkthrough. Thank you for testing WinBack.',
      );
    }
  }

  const key = `${type}:${userIdOrIp}`;
  const timestamps = memoryStore.get(key) ?? [];
  
  // Prune old timestamps
  const validTimestamps = timestamps.filter((t) => now - t < config.windowMs);
  
  if (validTimestamps.length >= config.maxRequests) {
    const oldest = validTimestamps[0]!;
    const retryAfter = Math.ceil((config.windowMs - (now - oldest)) / 1000);
    throw new RateLimitError('Demo rate limit reached — please wait a moment.', retryAfter);
  }

  validTimestamps.push(now);
  memoryStore.set(key, validTimestamps);

  if (type === 'llm') {
    globalLlmCalls++;
  }
}
