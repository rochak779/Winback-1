import { config } from 'dotenv';
config({ path: '.env.local' });
import { TARGET_DOCS } from '../src/data/target';
import { runExtraction } from '../src/lib/pipeline/extraction';
import { runDecision } from '../src/lib/pipeline/decision';
import { runMemo } from '../src/lib/pipeline/memo';
import { PEER_COMPANIES } from '../src/data/peers';
import { computeBenchmarkRows } from '../src/lib/pipeline/benchmark';
import { computeConcentration } from '../src/lib/pipeline/portfolio';
import { generateJson } from '../src/lib/pipeline/gemini';
import { z } from 'zod';
import { PORTFOLIO_COMPANIES } from '../src/data/portfolio';

import type { Provenance } from '../src/lib/contracts/types';

// Enable recording in gemini.ts
process.env.RECORD_GOLDEN = '1';
process.env.MOCK_LLM = '0'; // Ensure we use the real LLM

async function main() {
  console.log('Starting golden record process...');
  
  // 1. Extract
  console.log('Running extraction...');
  const extractionResult = await runExtraction([...TARGET_DOCS], TARGET_DOCS);
  
  // 2. Benchmark Commentary
  console.log('Running benchmark commentary...');
  const peers = PEER_COMPANIES.filter((peer) => peer.sector === extractionResult.profile.sector);
  const rows = computeBenchmarkRows(extractionResult.profile, peers);
  const prompt = [
    `Target company: ${extractionResult.profile.name} (${extractionResult.profile.sector}).`,
    'Already-computed benchmark rows (do not recompute or alter any number below):',
    JSON.stringify(rows, null, 2),
    '',
    'Write commentary describing these numbers. Never say "good", "bad", "strong", "weak", or any other evaluative word — describe direction and magnitude only.',
  ].join('\n');

  await generateJson({
    purpose: 'benchmark:commentary',
    systemInstruction:
      'You are a diligence analyst writing a short, neutral description of a benchmark table for an ' +
      'investment committee. You are given the numbers already computed; you may only describe them, ' +
      'never introduce a new figure or a judgement of whether they are good or bad.',
    prompt,
    responseSchema: {
      type: 'OBJECT',
      properties: { commentary: { type: 'STRING' } },
      required: ['commentary'],
    },
    zodSchema: z.object({ commentary: z.string() }),
    model: 'fast',
  });
  
  // 3. Portfolio Headline
  console.log('Running portfolio headline...');
  const dealSizeUsdM = 210;
  const portfolioResult = computeConcentration(PORTFOLIO_COMPANIES, extractionResult.profile.sector, dealSizeUsdM);
  const portfolioPrompt = [
    `Target company sector: ${extractionResult.profile.sector}`,
    `Deal size: $${dealSizeUsdM}m`,
    'Already-computed portfolio concentration rows (do not recompute or alter any number below):',
    JSON.stringify(portfolioResult.concentrations, null, 2),
    '',
    'Write a single-sentence headline summarizing this impact.',
  ].join('\n');

  await generateJson({
    purpose: 'portfolio:headline',
    systemInstruction:
      'You are a diligence analyst writing a single-sentence headline summarizing a deal\'s impact on portfolio sector concentration. Use the provided numbers; do not invent any.',
    prompt: portfolioPrompt,
    responseSchema: {
      type: 'OBJECT',
      properties: { headline: { type: 'STRING' } },
      required: ['headline'],
    },
    zodSchema: z.object({ headline: z.string() }),
    model: 'fast',
  });
  
  // 4. Decision (Crosscheck)
  console.log('Running decision (crosschecks)...');
  const decisionResult = await runDecision(TARGET_DOCS.map(d => d.id), extractionResult.profile, TARGET_DOCS);
  
  // 5. Memo
  console.log('Running memo...');
  await runMemo(
    {
      id: 'mock-deal',
      name: 'Project Meridian',
      targetCompany: 'Meridian Health Partners',
      sector: 'Healthcare Services',
      thesis: 'Strong recurring revenue base with an opportunity to improve margins.',
      dealSizeUsdM: 210,
      createdAt: new Date().toISOString()
    },
    extractionResult.profile,
    { peers, rows, commentary: 'Mock commentary', degraded: false, generatedAt: new Date().toISOString(), statementId: 's1', provenance: {} as unknown as Provenance },
    { portfolio: PORTFOLIO_COMPANIES, targetSector: 'Healthcare Services', targetDealSizeUsdM: 210, totalBeforeUsdM: portfolioResult.totalBeforeUsdM, totalAfterUsdM: portfolioResult.totalAfterUsdM, concentrations: portfolioResult.concentrations, headline: 'Mock headline', degraded: false, generatedAt: new Date().toISOString(), statementId: 's2', provenance: {} as unknown as Provenance },
    decisionResult.crosschecks
  );

  console.log('✅ All golden fixtures recorded successfully.');
}

main().catch(console.error);