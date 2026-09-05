// ============================================================================
// scripts/validate-data.ts — Lane A's self-check
//
// Run with `pnpm validate:data`. Must exit 0 before every Lane A push.
// Assertions 1-5 (erd.md Part 4 §4.5) land in session 1.1; assertion 6 in
// session 1.2; assertions 7-8 in session 1.3.
// ============================================================================

import { TARGET_DOCS, TARGET_COMPANY_IDENTITY } from '../src/data/target';
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

// 6. Contradiction 1 is structurally present.
{
  const mgmtPres = TARGET_DOCS.find((d) => d.id === 'mgmt-pres');
  const contracts = TARGET_DOCS.find((d) => d.id === 'contracts');

  if (mgmtPres && contracts) {
    const claimPattern = /\b\d{2}%\s+of\s+.*revenue.*recurring/i;
    const hasClaim = mgmtPres.blocks.some((b) => claimPattern.test(b.text));
    if (!hasClaim) {
      fail("[contradiction 1] no mgmt-pres block matches the recurring-revenue claim pattern");
    }

    // Group contract clauses by contract number (the 'c<n>-' prefix of the block id).
    const convenancePattern = /(for convenience|for any reason|without cause)/i;
    const thirtyDayPattern = /\bthirty\s*\(?30\)?\s*days\b|\b30\s*days\b/i;
    const acvPattern = /\$([\d.]+)m/;

    const byContract = new Map<string, typeof contracts.blocks>();
    for (const b of contracts.blocks) {
      const m = /^c(\d+)-/.exec(b.id);
      if (!m) continue;
      const key = m[1]!;
      const list = byContract.get(key) ?? [];
      list.push(b);
      byContract.set(key, list);
    }

    let qualifyingAcvUsdM = 0;
    let qualifyingCount = 0;
    for (const blocks of byContract.values()) {
      const hasConvenienceClause = blocks.some(
        (b) => convenancePattern.test(b.text) && thirtyDayPattern.test(b.text),
      );
      if (!hasConvenienceClause) continue;
      qualifyingCount += 1;
      const header = blocks.find((b) => b.id.endsWith('-h'));
      const acvMatch = header ? acvPattern.exec(header.text) : null;
      if (acvMatch) qualifyingAcvUsdM += Number(acvMatch[1]);
    }

    const fy24RevenueUsdM = TARGET_COMPANY_IDENTITY.financials.at(-1)?.revenueUsdM ?? 0;
    const qualifyingPctOfRevenue = fy24RevenueUsdM > 0 ? (qualifyingAcvUsdM / fy24RevenueUsdM) * 100 : 0;

    if (contracts.blocks.length > 0) {
      if (qualifyingCount < 3) {
        fail(`[contradiction 1] only ${qualifyingCount} contract(s) carry a 30-day convenience-termination clause; need >= 3`);
      }
      if (qualifyingPctOfRevenue < 20) {
        fail(
          `[contradiction 1] convenience-terminable contracts total $${qualifyingAcvUsdM}m (${qualifyingPctOfRevenue.toFixed(1)}% of FY24 revenue); need >= 20%`,
        );
      }
    }
  }
}

// 7. Contradiction 2 is structurally present.
//
// The raw documents never mark a grant as "reflected in the cap table" —
// that's a CompanyProfile-level field the extraction pipeline assigns later
// (Part 3 §3.2). At the data-fixture level, we can only check the shape:
// grants sorted by board-approval date should exhaust the cap table's
// stated "issued options" figure and then some. Grants whose cumulative
// total pushes past that figure are the ones the footnote's "issued and
// outstanding" language quietly leaves out.
{
  const capTable = TARGET_DOCS.find((d) => d.id === 'cap-table');
  const options = TARGET_DOCS.find((d) => d.id === 'options');

  if (capTable && options && options.blocks.length > 0) {
    const issuedRow = capTable.blocks.find((b) => /\(issued\)/i.test(b.text));
    const issuedMatch = issuedRow ? /([\d,]+)\s+shares/.exec(issuedRow.text) : null;
    const statedIssuedOptions = issuedMatch ? Number(issuedMatch[1]!.replace(/,/g, '')) : null;

    const totalRow = capTable.blocks.find((b) => b.id === 'total');
    const totalMatch = totalRow ? /([\d,]+)\s+shares/.exec(totalRow.text) : null;
    const statedFullyDiluted = totalMatch ? Number(totalMatch[1]!.replace(/,/g, '')) : null;

    if (statedIssuedOptions == null || statedFullyDiluted == null) {
      fail('[contradiction 2] could not parse the issued-options or fully-diluted figures from cap-table.ts');
    } else {
      // Lazy `.+?` (not a restricted character class) so grantee titles that
      // themselves contain an em dash (e.g. "Practice Manager — Charlotte")
      // still let the regex backtrack to the right split point.
      const grantPattern = /^(.+?)\s—\s([\d,]+)\s+options\s+—\s+Board approved\s+(\d{4}-\d{2}-\d{2})/;
      const grants = options.blocks
        .map((b) => grantPattern.exec(b.text))
        .filter((m): m is RegExpExecArray => m !== null)
        .map((m) => ({ options: Number(m[2]!.replace(/,/g, '')), date: m[3]! }))
        .sort((a, b) => a.date.localeCompare(b.date));

      let cumulative = 0;
      let notReflectedOptions = 0;
      let notReflectedCount = 0;
      for (const g of grants) {
        cumulative += g.options;
        if (cumulative > statedIssuedOptions) {
          notReflectedOptions += g.options;
          notReflectedCount += 1;
        }
      }

      const deltaPct = (notReflectedOptions / (statedFullyDiluted + notReflectedOptions)) * 100;

      if (notReflectedCount < 3) {
        fail(`[contradiction 2] only ${notReflectedCount} grant(s) fall outside the cap table's stated issued-options figure; need >= 3`);
      }
      if (deltaPct < 2) {
        fail(`[contradiction 2] grants outside the cap table move fully-diluted ownership by only ${deltaPct.toFixed(1)}pp; need >= 2pp`);
      }
    }
  }
}

// 8. TARGET_DOCS type-checks against SourceDoc[] — enforced by the `import
// type` above plus `pnpm typecheck`; nothing to check again at runtime.

if (failures.length > 0) {
  console.error(`validate-data: ${failures.length} failure(s)\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}

console.log(`validate-data: OK — ${TARGET_DOCS.length} docs, ${totalChars.toLocaleString()} total characters.`);
