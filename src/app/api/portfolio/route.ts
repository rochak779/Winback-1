// ============================================================================
// POST /api/portfolio — erd.md Part 2 §5.4, Part 5 §5.6
// ============================================================================

import { createHash } from 'node:crypto';
import { nanoid } from 'nanoid';
import { Type, type Schema } from '@google/genai';
import { z } from 'zod';
import { PORTFOLIO_COMPANIES } from '@/data/portfolio';
import { PortfolioRequestSchema, PortfolioResponseSchema } from '@/lib/contracts/schemas';
import type { ApiMeta, PortfolioImpact } from '@/lib/contracts/types';
import { apiSuccess, parseBody, validateOwnOutput, withRoute } from '@/lib/pipeline/http';
import { computeConcentration } from '@/lib/pipeline/portfolio';
import { generateJson } from '@/lib/pipeline/gemini';
import { recordAudit, type AuditSupabaseLike } from '@/lib/audit/record';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PROMPT_VERSION = 'portfolio-headline@v1';

const HeadlineSchema = z.object({ headline: z.string() });
const headlineResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    headline: {
      type: Type.STRING,
      description: 'One neutral sentence describing the sector-concentration change given. Introduce no new figure.',
    },
  },
  required: ['headline'],
};

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export async function POST(req: Request) {
  return withRoute(req, 'POST /api/portfolio', 'llm', async (userId) => {
    const started = Date.now();
    const parsed = await parseBody(req, PortfolioRequestSchema);
    if (!parsed.ok) return parsed.response;

    const { runId, profile, dealSizeUsdM } = parsed.data;
    const supabase = await createServerSupabaseClient();
    await recordAudit(supabase as unknown as AuditSupabaseLike, { runId, userId, actor: 'system', action: 'stage_started', stage: 'portfolio' });
    const { concentrations, totalBeforeUsdM, totalAfterUsdM } = computeConcentration(
      PORTFOLIO_COMPANIES,
      profile.sector,
      dealSizeUsdM,
    );

    let headline: string | null = null;
    let degraded = false;
    let model = 'none';
    let latencyMs: number | null = null;

    try {
      const prompt = [
        `Target sector: ${profile.sector}. Deal size: $${dealSizeUsdM}m.`,
        'Already-computed sector concentration (do not recompute or alter any number below):',
        JSON.stringify(concentrations, null, 2),
        '',
        'Write one sentence describing the change in the target sector\'s share of the portfolio. Never say "good", "bad", "risky", or any other evaluative word.',
      ].join('\n');

      const result = await generateJson<z.infer<typeof HeadlineSchema>>({
        purpose: 'portfolio:headline',
        systemInstruction:
          'You are a diligence analyst writing a single neutral sentence about how a proposed deal changes a ' +
          "portfolio's sector concentration. You are given the numbers already computed; you may only describe " +
          'them, never introduce a new figure or a judgement of whether the change is good or bad.',
        prompt,
        responseSchema: headlineResponseSchema,
        zodSchema: HeadlineSchema,
        model: 'fast',
      });
      headline = result.data.headline;
      model = result.model;
      latencyMs = result.ms;
    } catch {
      // Prose generation failing never fails the whole route (erd.md Part 5 §5.6).
      degraded = true;
    }

    const statementId = `portfolio:${nanoid()}`;
    const data: PortfolioImpact = {
      portfolio: PORTFOLIO_COMPANIES,
      targetSector: profile.sector,
      targetDealSizeUsdM: dealSizeUsdM,
      totalBeforeUsdM,
      totalAfterUsdM,
      concentrations,
      headline,
      degraded,
      generatedAt: new Date().toISOString(),
      statementId,
      provenance: {
        statementId,
        stage: 'portfolio',
        actor: degraded ? 'system' : 'model',
        producedBy: degraded ? 'deterministic' : model,
        promptVersion: degraded ? null : PROMPT_VERSION,
        inputHash: sha256Hex(JSON.stringify({ profileStatementId: profile.statementId, dealSizeUsdM })),
        generatedAt: new Date().toISOString(),
        latencyMs,
      },
    };

    const violation = validateOwnOutput(PortfolioResponseSchema, { ok: true, data, meta: { ms: 0, model, mock: false } });
    if (violation) return violation;

    const meta: ApiMeta = { ms: Date.now() - started, model, mock: model === 'mock' };
    await recordAudit(supabase as unknown as AuditSupabaseLike, [
      { runId, userId, actor: 'system', action: 'stage_completed', stage: 'portfolio' },
      {
        runId, userId, actor: data.provenance.actor, action: 'statement_generated', stage: 'portfolio',
        statementId: data.statementId, statementText: data.headline ?? 'Portfolio impact computed (no headline — degraded)',
        provenance: data.provenance,
      },
    ]);
    return apiSuccess(data, meta);
  });
}
