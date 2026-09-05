// ============================================================================
// scripts/validate-data.ts — Lane A's self-check
//
// Run with `pnpm validate:data`. Must exit 0 before every Lane A push.
// Assertions 1-5 (erd.md Part 4 §4.5) land in session 1.1; assertion 6 in
// 1.2; assertions 7-8 in 1.3. Assertion 8 (TARGET_DOCS type-checks against
// SourceDoc[]) is enforced by the `import type` below plus `pnpm typecheck` —
// this file doesn't re-check it at runtime.
// ============================================================================

import { TARGET_DOCS } from '../src/data/target';
import type { SourceDoc } from '../src/lib/contracts/types';

const ID_PATTERN: Record<SourceDoc['id'], RegExp> = {
  'mgmt-pres': /^s\d+-b\d+$/,
  contracts: /^c\d+-(h|cl\d+)$/,
  'cap-table': /^(row-\d+|hdr|total|note-\d+)$/,
  options: /^(g\d+|hdr)$/,
};

const MAX_BLOCK_CHARS = 1_200;
const MAX_TOTAL_CHARS = 40_000;

const failures: string[] = [];
const fail = (msg: string) => failures.push(msg);

let totalChars = 0;

for (const doc of TARGET_DOCS) {
  const seenIds = new Set<string>();
  const pattern = ID_PATTERN[doc.id];
  let lastPage = 0;
  let maxPage = 0;

  for (const block of doc.blocks) {
    // 1. Every block id unique within its doc; matches its doc's id pattern.
    if (seenIds.has(block.id)) fail(`[${doc.id}] duplicate block id '${block.id}'`);
    seenIds.add(block.id);
    if (!pattern.test(block.id)) {
      fail(`[${doc.id}] block id '${block.id}' doesn't match pattern ${pattern}`);
    }

    // 2. No empty text; no block over 1,200 characters.
    if (block.text.trim().length === 0) fail(`[${doc.id}] block '${block.id}' has empty text`);
    if (block.text.length > MAX_BLOCK_CHARS) {
      fail(`[${doc.id}] block '${block.id}' is ${block.text.length} chars, over the ${MAX_BLOCK_CHARS} limit`);
    }

    // 3. page is monotonically non-decreasing; pages equals the max page.
    if (block.page < lastPage) {
      fail(`[${doc.id}] block '${block.id}' page ${block.page} regresses from previous page ${lastPage}`);
    }
    lastPage = block.page;
    maxPage = Math.max(maxPage, block.page);

    // 4. Every block has a section.
    if (!block.section) fail(`[${doc.id}] block '${block.id}' is missing a section`);

    totalChars += block.text.length;
  }

  if (doc.blocks.length > 0 && doc.pages !== maxPage) {
    fail(`[${doc.id}] doc.pages (${doc.pages}) does not equal the max block page (${maxPage})`);
  }
}

// 5. Total characters across all docs <= 40,000.
if (totalChars > MAX_TOTAL_CHARS) {
  fail(`total characters across all docs (${totalChars}) exceeds the ${MAX_TOTAL_CHARS} budget`);
}

if (failures.length > 0) {
  console.error(`validate-data: ${failures.length} failure(s)\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}

console.log(`validate-data: OK — ${TARGET_DOCS.length} docs, ${totalChars.toLocaleString()} total characters.`);
