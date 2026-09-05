// ============================================================================
// scripts/tune-crosscheck.ts
//
// Session 2.3's iteration tool (erd.md Part 5 §5.7). Runs both crosschecks
// against the real Kestrel documents N times (default 5) and reports, per
// run, status + valid counter-evidence count for each — so the prompts can
// be tuned against real Gemini output rather than guessed at.
//
// Acceptance bar: five consecutive runs where BOTH crosschecks return
// 'contradiction_found' with >=2 valid counter-evidence refs each.
//
// Run: pnpm tsx scripts/tune-crosscheck.ts [n]
// ============================================================================

import { existsSync } from 'node:fs';
if (existsSync('.env.local')) process.loadEnvFile('.env.local');

import { TARGET_DOCS } from '../src/data/target';
import { CROSSCHECK_DEFS } from '../src/lib/pipeline/prompts';
import { runCrosscheckDef } from '../src/lib/pipeline/crosscheck';

const N = Number(process.argv[2] ?? 5);
const MIN_COUNTER_EVIDENCE = 2;

async function runOnce(iteration: number): Promise<boolean> {
  const results = await Promise.all(
    CROSSCHECK_DEFS.map(async ({ def, version }) => {
      const started = Date.now();
      const { data, ms, droppedEvidenceRefs } = await runCrosscheckDef(def, version, TARGET_DOCS);
      return { id: def.id, ms, droppedEvidenceRefs, data, wallMs: Date.now() - started };
    }),
  );

  console.log(`\n=== Run ${iteration} ===`);
  let allPass = true;
  for (const r of results) {
    const pass = r.data.status === 'contradiction_found' && r.data.counterEvidence.length >= MIN_COUNTER_EVIDENCE;
    allPass &&= pass;
    console.log(
      `[${r.id}] status=${r.data.status} counterEvidence=${r.data.counterEvidence.length} ` +
        `dropped=${r.droppedEvidenceRefs} ms=${r.ms} pass=${pass}`,
    );
    console.log(`  claim: ${r.data.claim.text}`);
    console.log(`  explanation: ${r.data.explanation}`);
    if (r.data.quantification) {
      const q = r.data.quantification;
      console.log(`  quantification: ${q.label} claimed=${q.claimedValue}${q.unit} observed=${q.observedValue}${q.unit} (${q.note})`);
    }
  }
  return allPass;
}

async function main() {
  let consecutivePasses = 0;
  for (let i = 1; i <= N; i++) {
    const passed = await runOnce(i);
    consecutivePasses = passed ? consecutivePasses + 1 : 0;
    if (!passed) {
      console.log(`\n✗ Run ${i} failed the acceptance bar. Consecutive streak reset to 0.`);
    }
  }
  console.log(`\n${consecutivePasses}/${N} consecutive passes.`);
  if (consecutivePasses < N) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
