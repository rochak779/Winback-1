import { Type, type Schema } from '@google/genai';
import { z } from 'zod';
import { MemoSectionIdSchema } from '@/lib/contracts/schemas';
import { ModelEvidenceRefSchema, evidenceArraySchema } from '@/lib/pipeline/schema-helpers';
import type { BenchmarkResult, CompanyProfile, Crosscheck, Deal, PortfolioImpact } from '@/lib/contracts/types';

export const MEMO_PROMPT_VERSION = 'memo-v1';

export const BANNED_PHRASES = [
  'game-changer',
  'revolutionary',
  'synergy',
  'disrupt',
  'leverage',
  'delve',
  'dive',
  'landscape',
  'traction',
];

export const ModelMemoSectionSchema = z.object({
  id: MemoSectionIdSchema,
  heading: z.string(),
  body: z.string(),
  evidence: z.array(ModelEvidenceRefSchema),
});

export const ModelMemoSchema = z.object({
  sections: z.array(ModelMemoSectionSchema),
}).superRefine((data, ctx) => {
  const allText = data.sections.map(s => s.body).join(' ').toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (new RegExp(`\\b${phrase}\\b`, 'i').test(allText)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Banned phrase used: "${phrase}". Rewrite the memo objectively without it.`,
      });
    }
  }
});
export type ModelMemo = z.infer<typeof ModelMemoSchema>;

export const memoResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            format: 'enum',
            enum: MemoSectionIdSchema.options as unknown as string[],
          },
          heading: { type: Type.STRING },
          body: { type: Type.STRING, description: 'Markdown-lite: paragraphs and "- " bullets only.' },
          evidence: evidenceArraySchema('Evidence references from the provided data supporting this section.'),
        },
        required: ['id', 'heading', 'body', 'evidence'],
      },
    },
  },
  required: ['sections'],
};

export function buildMemoPrompt(data: {
  deal: Deal;
  profile: CompanyProfile;
  benchmark: BenchmarkResult;
  portfolio: PortfolioImpact;
  crosschecks: Crosscheck[];
}): { systemInstruction: string; prompt: string } {
  const systemInstruction = `You are a private equity associate drafting an Investment Committee (IC) memo. 
Your tone must be neutral, precise, and entirely objective. 
You are strictly prohibited from using the following words: ${BANNED_PHRASES.join(', ')}.
Do not invent information. Rely only on the provided data.
Keep paragraphs short. Use simple markdown (paragraphs and '- ' bullets only).
The sections to generate are: situation, numbers, portfolio_fit, requires_confirmation, next_steps.
Cite evidence refs when appropriate using the given docId and blockId from the provided data.`;

  const prompt = `Provided Deal Data:
${JSON.stringify(data.deal, null, 2)}

Target Profile:
${JSON.stringify(data.profile, null, 2)}

Benchmark Data:
${JSON.stringify(data.benchmark, null, 2)}

Portfolio Impact:
${JSON.stringify(data.portfolio, null, 2)}

Crosschecks:
${JSON.stringify(data.crosschecks, null, 2)}

Draft the IC memo sections based solely on this data. Make sure to cover the 5 required sections.`;

  return { systemInstruction, prompt };
}
