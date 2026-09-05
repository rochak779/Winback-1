// ============================================================================
// src/data/target/customer-contracts.ts — Lane A
//
// Project Kestrel — Customer Contracts ('contracts', pageNoun: 'page').
//
// Six contracts. Three (Blackwood, Amber Creek, Sable Point) are genuinely
// sticky — multi-year, auto-renewing, terminable for cause only. Three
// (Cinderwood, Thistlebrook, Fenwick) carry a termination-for-convenience
// right on 30 days' notice, each phrased differently, together worth ~31%
// of FY24 revenue — the counter-evidence to the mgmt deck's 80%-recurring
// claim in mgmt-presentation.ts. No block here says so; the model has to
// read the term sheets and add it up. See index.ts for the ground truth.
// ============================================================================

import type { SourceDoc } from '@/lib/contracts/types';

export const CUSTOMER_CONTRACTS: SourceDoc = {
  id: 'contracts',
  kind: 'customer_contracts',
  title: 'Project Kestrel — Customer Contracts',
  filename: 'kestrel_customer_contracts_bundle.pdf',
  dateLabel: 'May 2026',
  pages: 6,
  pageNoun: 'page',
  blocks: [
    // --- Contract 1: Blackwood Regional Health Network — sticky ---
    {
      id: 'c1-h',
      kind: 'kv',
      page: 1,
      section: 'Contract 1 — Blackwood Regional Health Network',
      text: 'Customer: Blackwood Regional Health Network. Effective Date: September 1, 2020. Annual Contract Value: $8.4m.',
    },
    {
      id: 'c1-cl1',
      kind: 'clause',
      page: 1,
      section: 'Contract 1 — Blackwood Regional Health Network',
      text: "Initial Term: sixty (60) months from the Effective Date, renewing automatically for successive twenty-four (24) month terms unless either party provides one hundred eighty (180) days' written notice of non-renewal.",
    },
    {
      id: 'c1-cl2',
      kind: 'clause',
      page: 1,
      section: 'Contract 1 — Blackwood Regional Health Network',
      text: "Neither party may terminate this Agreement prior to the expiration of the Term except upon the other party's material breach that remains uncured for thirty (30) days following written notice, or upon the other party's insolvency.",
    },
    {
      id: 'c1-cl3',
      kind: 'clause',
      page: 1,
      section: 'Contract 1 — Blackwood Regional Health Network',
      text: 'Provider shall maintain equipment uptime of not less than 98.5% measured on a rolling ninety (90) day basis, with service credits payable for any shortfall.',
    },

    // --- Contract 2: Cinderwood Health System — "for convenience" ---
    {
      id: 'c2-h',
      kind: 'kv',
      page: 2,
      section: 'Contract 2 — Cinderwood Health System',
      text: 'Customer: Cinderwood Health System. Effective Date: February 1, 2023. Annual Contract Value: $5.2m.',
    },
    {
      id: 'c2-cl1',
      kind: 'clause',
      page: 2,
      section: 'Contract 2 — Cinderwood Health System',
      text: 'Initial Term: twenty-four (24) months from the Effective Date.',
    },
    {
      id: 'c2-cl2',
      kind: 'clause',
      page: 2,
      section: 'Contract 2 — Cinderwood Health System',
      text: "Either party may terminate this Agreement for convenience upon thirty (30) days' prior written notice to the other party.",
    },
    {
      id: 'c2-cl3',
      kind: 'clause',
      page: 2,
      section: 'Contract 2 — Cinderwood Health System',
      text: "Each party shall keep confidential all proprietary information of the other party disclosed in connection with this Agreement, using the same degree of care it uses to protect its own confidential information.",
    },

    // --- Contract 3: Amber Creek Physician Alliance — sticky ---
    {
      id: 'c3-h',
      kind: 'kv',
      page: 3,
      section: 'Contract 3 — Amber Creek Physician Alliance',
      text: 'Customer: Amber Creek Physician Alliance. Effective Date: November 1, 2021. Annual Contract Value: $7.1m.',
    },
    {
      id: 'c3-cl1',
      kind: 'clause',
      page: 3,
      section: 'Contract 3 — Amber Creek Physician Alliance',
      text: "Initial Term: forty-eight (48) months from the Effective Date, renewing automatically for successive twelve (12) month terms absent one hundred twenty (120) days' written notice of non-renewal.",
    },
    {
      id: 'c3-cl2',
      kind: 'clause',
      page: 3,
      section: 'Contract 3 — Amber Creek Physician Alliance',
      text: "This Agreement may be terminated prior to the end of the Term only for the other party's uncured material breach or a change of control not approved in advance.",
    },
    {
      id: 'c3-cl3',
      kind: 'clause',
      page: 3,
      section: 'Contract 3 — Amber Creek Physician Alliance',
      text: 'Provider shall respond to routine service requests within two (2) business days and to urgent requests within four (4) hours.',
    },

    // --- Contract 4: Thistlebrook Specialty Partners — "for any reason or no reason" ---
    {
      id: 'c4-h',
      kind: 'kv',
      page: 4,
      section: 'Contract 4 — Thistlebrook Specialty Partners',
      text: 'Customer: Thistlebrook Specialty Partners. Effective Date: July 1, 2023. Annual Contract Value: $4.6m.',
    },
    {
      id: 'c4-cl1',
      kind: 'clause',
      page: 4,
      section: 'Contract 4 — Thistlebrook Specialty Partners',
      text: 'Initial Term: twenty-four (24) months from the Effective Date.',
    },
    {
      id: 'c4-cl2',
      kind: 'clause',
      page: 4,
      section: 'Contract 4 — Thistlebrook Specialty Partners',
      text: "Client may terminate this Agreement for any reason or no reason at all upon thirty (30) days' written notice to Provider.",
    },
    {
      id: 'c4-cl3',
      kind: 'clause',
      page: 4,
      section: 'Contract 4 — Thistlebrook Specialty Partners',
      text: 'Confidential Information disclosed under this Agreement may be used solely to perform the services described herein and shall not be disclosed to any third party without prior written consent.',
    },

    // --- Contract 5: Sable Point Medical Group — sticky ---
    {
      id: 'c5-h',
      kind: 'kv',
      page: 5,
      section: 'Contract 5 — Sable Point Medical Group',
      text: 'Customer: Sable Point Medical Group. Effective Date: March 1, 2022. Annual Contract Value: $6.6m.',
    },
    {
      id: 'c5-cl1',
      kind: 'clause',
      page: 5,
      section: 'Contract 5 — Sable Point Medical Group',
      text: "Initial Term: thirty-six (36) months from the Effective Date, renewing automatically for successive twelve (12) month terms unless either party provides ninety (90) days' written notice of non-renewal.",
    },
    {
      id: 'c5-cl2',
      kind: 'clause',
      page: 5,
      section: 'Contract 5 — Sable Point Medical Group',
      text: "Termination prior to the end of the Term is permitted only upon the other party's uncured material breach following thirty (30) days' written notice and opportunity to cure.",
    },
    {
      id: 'c5-cl3',
      kind: 'clause',
      page: 5,
      section: 'Contract 5 — Sable Point Medical Group',
      text: 'Provider shall staff each site in accordance with the minimum credentialed-technologist ratios set forth in Exhibit B.',
    },

    // --- Contract 6: Fenwick Diagnostic Alliance — "without cause" ---
    {
      id: 'c6-h',
      kind: 'kv',
      page: 6,
      section: 'Contract 6 — Fenwick Diagnostic Alliance',
      text: 'Customer: Fenwick Diagnostic Alliance. Effective Date: October 1, 2023. Annual Contract Value: $4.4m.',
    },
    {
      id: 'c6-cl1',
      kind: 'clause',
      page: 6,
      section: 'Contract 6 — Fenwick Diagnostic Alliance',
      text: 'Initial Term: twenty-four (24) months from the Effective Date.',
    },
    {
      id: 'c6-cl2',
      kind: 'clause',
      page: 6,
      section: 'Contract 6 — Fenwick Diagnostic Alliance',
      text: "Client may terminate this Agreement without cause at any time upon thirty (30) days' prior written notice to Provider.",
    },
    {
      id: 'c6-cl3',
      kind: 'clause',
      page: 6,
      section: 'Contract 6 — Fenwick Diagnostic Alliance',
      text: "Each party's obligations of confidentiality under this Section shall survive termination of this Agreement for a period of three (3) years.",
    },
  ],
};
