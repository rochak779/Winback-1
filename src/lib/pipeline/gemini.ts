// ============================================================================
// src/lib/pipeline/gemini.ts
//
// The single Gemini surface (erd.md Part 5 §5.3). No other file may import
// `@google/genai` — every pipeline route calls `generateJson<T>()` here
// instead, so model config, retry, timeout, logging, and MOCK_LLM all live
// in one place.
// ============================================================================

import { GoogleGenAI } from '@google/genai';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { z } from 'zod';

// Verified live against this project's key on 2026-09-05 (see .env.example) —
// gemini-2.5-* has aged out. The '-latest' aliases are Google's own stable
// pointers, which is what a fast-moving build wants for a default.
const FAST_MODEL = process.env.GEMINI_MODEL ?? 'gemini-flash-latest';
const REASONING_MODEL = process.env.GEMINI_MODEL_REASONING ?? 'gemini-pro-latest';

const RETRY_DELAY_MS = 1500;

// `MOCK_LLM` is a development-only escape hatch (erd.md Part 2 §9). This
// guard runs at module load so a misconfigured production deploy fails fast
// instead of silently serving fixtures.
if (process.env.MOCK_LLM === '1' && process.env.VERCEL_ENV === 'production') {
  throw new Error('MOCK_LLM must never be enabled in production');
}

export class LlmTimeoutError extends Error {
  constructor(purpose: string) {
    super(`Gemini call timed out: ${purpose}`);
    this.name = 'LlmTimeoutError';
  }
}

export class LlmError extends Error {
  constructor(purpose: string, cause: unknown) {
    super(`Gemini call failed: ${purpose}: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'LlmError';
    this.cause = cause;
  }
}

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (client) return client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  client = new GoogleGenAI({ apiKey });
  return client;
}

/** 429/5xx are worth one blind retry; 4xx other than 429 are not. */
function isRetryableTransient(err: unknown): boolean {
  const status =
    (err as { status?: number } | undefined)?.status ??
    (err as { response?: { status?: number } } | undefined)?.response?.status;
  if (typeof status === 'number') return status === 429 || status >= 500;
  const message = err instanceof Error ? err.message : String(err);
  return /\b429\b|rate.?limit|\b5\d\d\b/i.test(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readGoldenFixture<T>(purpose: string): Promise<T> {
  const file = path.join(process.cwd(), 'src', 'data', 'golden', `${purpose}.json`);
  const raw = readFileSync(file, 'utf-8');
  return JSON.parse(raw) as T;
}

export interface GenerateJsonOpts<T> {
  /** e.g. 'extract:mgmt-pres', 'crosscheck:recurring_revenue' — never document text. */
  purpose: string;
  systemInstruction: string;
  prompt: string;
  /** Gemini's responseSchema (not zod) — enforced by the API itself. */
  responseSchema: object;
  model?: 'fast' | 'reasoning';
  temperature?: number;
  timeoutMs?: number;
  /**
   * Not in the erd.md's illustrative signature, but required by its own
   * prose: "if the model returns JSON that fails the zod schema, retry once
   * with the validation error appended to the prompt." Optional so callers
   * that only rely on Gemini's own responseSchema can skip it.
   */
  zodSchema?: z.ZodType<T>;
}

export interface GenerateJsonResult<T> {
  data: T;
  ms: number;
  model: string;
  mock: boolean;
}

export async function generateJson<T>(opts: GenerateJsonOpts<T>): Promise<GenerateJsonResult<T>> {
  const {
    purpose,
    systemInstruction,
    prompt,
    responseSchema,
    model = 'fast',
    temperature = 0,
    timeoutMs = 45_000,
    zodSchema,
  } = opts;

  const started = Date.now();

  if (process.env.MOCK_LLM === '1') {
    const data = await readGoldenFixture<T>(purpose);
    return { data, ms: Date.now() - started, model: 'mock', mock: true };
  }

  const modelId = model === 'reasoning' ? REASONING_MODEL : FAST_MODEL;

  async function callOnce(promptText: string): Promise<unknown> {
    const ai = getClient();
    let response;
    try {
      response = await ai.models.generateContent({
        model: modelId,
        contents: promptText,
        config: {
          systemInstruction,
          temperature,
          responseMimeType: 'application/json',
          responseSchema,
          abortSignal: AbortSignal.timeout(timeoutMs),
        },
      });
    } catch (err) {
      if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
        throw new LlmTimeoutError(purpose);
      }
      throw err;
    }
    const text = response.text;
    if (!text) throw new LlmError(purpose, new Error('empty response text'));
    return JSON.parse(text);
  }

  // Recursive attempt loop. `allowTransientRetry` and `allowValidationRetry`
  // are each "exactly one retry" per erd.md §5.3 — independent allowances,
  // not chained: a call either times out/5xx's once, or fails validation
  // once, not both indefinitely.
  async function attempt(
    promptText: string,
    allowTransientRetry: boolean,
    allowValidationRetry: boolean,
  ): Promise<T> {
    let parsed: unknown;
    try {
      parsed = await callOnce(promptText);
    } catch (err) {
      if (err instanceof LlmTimeoutError || isRetryableTransient(err)) {
        if (allowTransientRetry) {
          await sleep(RETRY_DELAY_MS);
          return attempt(promptText, false, allowValidationRetry);
        }
        throw err instanceof LlmTimeoutError ? err : new LlmError(purpose, err);
      }
      throw new LlmError(purpose, err);
    }

    if (!zodSchema) return parsed as T;

    const result = zodSchema.safeParse(parsed);
    if (result.success) return result.data;

    if (allowValidationRetry) {
      const retryPrompt = `${promptText}\n\nYour previous response failed validation because: ${result.error.message}\nRespond again with corrected JSON that matches the schema exactly.`;
      return attempt(retryPrompt, allowTransientRetry, false);
    }
    throw new LlmError(purpose, new Error(`schema validation failed: ${result.error.message}`));
  }

  try {
    const data = await attempt(prompt, true, true);
    const ms = Date.now() - started;
    logCall({ purpose, model: modelId, ms, inChars: prompt.length, outChars: JSON.stringify(data).length, ok: true });
    return { data, ms, model: modelId, mock: false };
  } catch (err) {
    const ms = Date.now() - started;
    logCall({ purpose, model: modelId, ms, inChars: prompt.length, outChars: 0, ok: false });
    throw err;
  }
}

/** One structured log line per call. Never logs document content or the key. */
function logCall(entry: {
  purpose: string;
  model: string;
  ms: number;
  inChars: number;
  outChars: number;
  ok: boolean;
}): void {
  console.log('[winback:gemini]', JSON.stringify(entry));
}
