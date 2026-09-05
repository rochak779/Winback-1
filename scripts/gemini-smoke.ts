// ============================================================================
// scripts/gemini-smoke.ts
//
// Session 0.3 smoke test: prove a Gemini call with structured JSON output
// works from this repo before anything is built on top of it.
//
// Google Cloud / Firebase setup is deferred to Phase 6 (per session decision);
// this uses a Google AI Studio key (GEMINI_API_KEY) directly, no GCP project
// or billing account required for the free tier.
//
// Run: pnpm tsx scripts/gemini-smoke.ts
// ============================================================================

import { existsSync } from 'node:fs';
import { GoogleGenAI, Type } from '@google/genai';

// Node's built-in loader — avoids adding a dotenv dependency for one script.
if (existsSync('.env.local')) process.loadEnvFile('.env.local');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY is not set. Add it to .env.local and try again.');
  process.exit(1);
}

// Verified against the installed SDK's live model list (2026-09), not memory —
// gemini-2.5-* has aged out as the frontier tier since the ERD was written.
// The '-latest' aliases are Google's own stable pointers, which is exactly
// what a fast-moving hackathon build wants for a default.
const model = process.env.GEMINI_MODEL ?? 'gemini-flash-latest';

const ai = new GoogleGenAI({ apiKey });

async function main() {
  const response = await ai.models.generateContent({
    model,
    contents: 'Name one fictional healthcare-services company and its founding year.',
    config: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          companyName: { type: Type.STRING },
          foundedYear: { type: Type.INTEGER },
        },
        required: ['companyName', 'foundedYear'],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error('Gemini returned no text on the response.');

  const parsed = JSON.parse(text);
  console.log(`Model: ${model}`);
  console.log('Parsed object:', parsed);
}

main().catch((err) => {
  console.error('Gemini smoke test failed:', err);
  process.exit(1);
});
