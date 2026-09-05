import { createHash } from 'node:crypto';
import { nanoid } from 'nanoid';
import { generateJson } from '@/lib/pipeline/gemini';
import { MEMO_PROMPT_VERSION, ModelMemoSchema, buildMemoPrompt, memoResponseSchema, type ModelMemo } from '@/lib/pipeline/prompts/memo';
import { toEvidenceRef } from '@/lib/pipeline/schema-helpers';
import { validateEvidence } from '@/lib/evidence';
import { TARGET_DOCS } from '@/data/target';
import type { BenchmarkResult, CompanyProfile, Crosscheck, Deal, IcMemo, PortfolioImpact } from '@/lib/contracts/types';

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

const MEMO_DISCLAIMER = "CONFIDENTIAL: For internal Investment Committee use only. Not for distribution. This document is generated based on initial diligence and is subject to further verification.";

export async function runMemo(
  deal: Deal,
  profile: CompanyProfile,
  benchmark: BenchmarkResult,
  portfolio: PortfolioImpact,
  crosschecks: Crosscheck[],
): Promise<IcMemo> {
  const { systemInstruction, prompt } = buildMemoPrompt({ deal, profile, benchmark, portfolio, crosschecks });

  const { data, model, ms } = await generateJson<ModelMemo>({
    purpose: 'memo',
    systemInstruction,
    prompt,
    responseSchema: memoResponseSchema,
    zodSchema: ModelMemoSchema,
    model: 'fast', // Fast model to avoid timeouts
  });

  const statementId = `memo:${nanoid()}`;
  
  const sections = data.sections.map((section) => {
    const evidenceResult = validateEvidence(section.evidence.map(toEvidenceRef), TARGET_DOCS, {
      purpose: `memo:${section.id}@${MEMO_PROMPT_VERSION}`,
    });

    const sectionStatementId = `${statementId}:${section.id}`;
    return {
      id: section.id,
      heading: section.heading,
      body: section.body,
      evidence: evidenceResult.valid,
      statementId: sectionStatementId,
      provenance: {
        statementId: sectionStatementId,
        stage: 'memo' as const,
        actor: 'model' as const,
        producedBy: model,
        promptVersion: MEMO_PROMPT_VERSION,
        inputHash: sha256Hex(JSON.stringify({ 
          dealId: deal.id, 
          profileStatementId: profile.statementId,
          benchmarkStatementId: benchmark.statementId,
          portfolioStatementId: portfolio.statementId,
        })),
        generatedAt: new Date().toISOString(),
        latencyMs: ms,
      },
      edited: false,
      originalBody: null,
    };
  });

  return {
    dealName: deal.name,
    targetCompany: deal.targetCompany,
    thesis: deal.thesis,
    sections,
    disclaimer: MEMO_DISCLAIMER,
    generatedAt: new Date().toISOString(),
    status: 'draft',
  };
}
