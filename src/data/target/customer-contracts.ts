// ============================================================================
// src/data/target/customer-contracts.ts — Lane A
//
// Project Kestrel — Customer Contracts ('contracts', pageNoun: 'page').
// Six to eight contracts; three carry termination-for-convenience language
// that breaks the mgmt deck's 80%-recurring claim. Blocks land in session 1.2.
// Block id pattern: c<contract>-h (header) or c<contract>-cl<n> (clause).
// ============================================================================

import type { SourceDoc } from '@/lib/contracts/types';

export const CUSTOMER_CONTRACTS: SourceDoc = {
  id: 'contracts',
  kind: 'customer_contracts',
  title: 'Project Kestrel — Customer Contracts',
  filename: 'kestrel_customer_contracts_bundle.pdf',
  dateLabel: 'May 2026',
  pages: 0,
  pageNoun: 'page',
  blocks: [],
};
