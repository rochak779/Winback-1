// ============================================================================
// POST /api/benchmark — erd.md Part 2 §5.3, Part 5 §5.6
// ============================================================================

import { createHash } from 'node:crypto';
import { nanoid } from 'nanoid';
import { Type, type Schema } from '@google/genai';
import { z } from 'zod';
import { PEER_COMPANIES } from '@/data/peers';
import { BenchmarkRequestSchema, BenchmarkResponseSchema } from '@/lib/contracts/schemas';
import type { ApiMeta, BenchmarkResult } from '@/lib/contracts/types';
import { apiSuccess, parseBody, validateOwnOutput, withRoute } from '@/lib/pipeline/http';
import { computeBenchmarkRows } from '@/lib/pipeline/benchmark';
import { generateJson } from '@/lib/pipeline/gemini';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PROMPT_VERSION = 'benchmark-commentary@v1';

const CommentarySchema = z.object({ commentary: z.string() });
const commentaryResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    commentary: {
      type: Type.STRING,
      description: '2-3 neutral sentences describing the numbers given. Introduce no new figure. No evaluative language ("good"/"bad"/"strong"/"weak").',
    },
  },
  required: ['commentary'],
};

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export async function POST(req: Request) {
  return withRoute(req, 'POST /api/benchmark', 'llm', async (userId) => {
    const started = Date.now();
    const parsed = await parseBody(req, BenchmarkRequestSchema);
    if (!parsed.ok) return parsed.response;

    const { profile } = parsed.data;
    const peers = PEER_COMPANIES.filter((peer) => peer.sector === profile.sector);
    const rows = computeBenchmarkRows(profile, peers);

    let commentary: string | null = null;
    let degraded = false;
    let model = 'none';
    let latencyMs: number | null = null;

    try {
      const prompt = [
        `Target company: ${profile.name} (${profile.sector}).`,
        'Already-computed benchmark rows (do not recompute or alter any number below):',
        JSON.stringify(rows, null, 2),
        '',
        'Write commentary describing these numbers. Never say "good", "bad", "strong", "weak", or any other evaluative word — describe direction and magnitude only.',
      ].join('\n');

      const result = await generateJson<z.infer<typeof CommentarySchema>>({
        purpose: 'benchmark:commentary',
        systemInstruction:
          'You are a diligence analyst writing a short, neutral description of a benchmark table for an ' +
          'investment committee. You are given the numbers already computed; you may only describe them, ' +
          'never introduce a new figure or a judgement of whether they are good or bad.',
        prompt,
        responseSchema: commentaryResponseSchema,
        zodSchema: CommentarySchema,
        model: 'fast',
      });
      commentary = result.data.commentary;
      model = result.model;
      latencyMs = result.ms;
    } catch {
      // Prose generation failing never fails the whole route (erd.md Part 5 §5.6).
      degraded = true;
    }

    const statementId = `benchmark:${nanoid()}`;
    const data: BenchmarkResult = {
      peers,
      rows,
      commentary,
      degraded,
      generatedAt: new Date().toISOString(),
      statementId,
      provenance: {
        statementId,
        stage: 'benchmark',
        actor: degraded ? 'system' : 'model',
        producedBy: degraded ? 'deterministic' : model,
        promptVersion: degraded ? null : PROMPT_VERSION,
        inputHash: sha256Hex(JSON.stringify({ profileStatementId: profile.statementId, peerIds: peers.map((p) => p.id) })),
        generatedAt: new Date().toISOString(),
        latencyMs,
      },
    };

    const violation = validateOwnOutput(BenchmarkResponseSchema, { ok: true, data, meta: { ms: 0, model, mock: false } });
    if (violation) return violation;

    const meta: ApiMeta = { ms: Date.now() - started, model, mock: model === 'mock' };
    return apiSuccess(data, meta);
  });
}
