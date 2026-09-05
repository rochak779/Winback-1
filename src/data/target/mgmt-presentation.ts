// ============================================================================
// src/data/target/mgmt-presentation.ts — Lane A
//
// Project Kestrel — Management Presentation ('mgmt-pres', pageNoun: 'slide').
// Contradiction 1 lives in slide 3 (Revenue Quality): the deck claims ~80%
// of FY24 revenue is recurring and says nothing about cancellation terms.
// See customer-contracts.ts for the counter-evidence, and index.ts for the
// ground-truth recurring % this claim should be checked against.
// ============================================================================

import type { SourceDoc } from '@/lib/contracts/types';

export const MGMT_PRESENTATION: SourceDoc = {
  id: 'mgmt-pres',
  kind: 'management_presentation',
  title: 'Project Kestrel — Management Presentation',
  filename: 'kestrel_mgmt_presentation_v1.pdf',
  dateLabel: 'June 2026',
  pages: 8,
  pageNoun: 'slide',
  blocks: [
    // --- Slide 1: Company overview ---
    {
      id: 's1-b1',
      kind: 'heading',
      page: 1,
      section: 'Company Overview',
      text: 'Project Kestrel — Management Presentation',
    },
    {
      id: 's1-b2',
      kind: 'paragraph',
      page: 1,
      section: 'Company Overview',
      text: 'Kestrelbrook Health Partners operates a network of outpatient diagnostic imaging and specialty care clinics across the Carolinas, serving regional health systems and independent physician groups under long-term service agreements. Founded in 2013 and headquartered in Raleigh, NC, the company has built a differentiated position through clinical quality, physician relationships, and disciplined site selection.',
    },

    // --- Slide 2: Market opportunity ---
    {
      id: 's2-b1',
      kind: 'paragraph',
      page: 2,
      section: 'Market Opportunity',
      text: 'The outpatient diagnostics and specialty care market continues to benefit from the ongoing shift of procedures away from higher-cost hospital settings, with regional health systems increasingly outsourcing ancillary service lines to specialized operators like Kestrelbrook.',
    },

    // --- Slide 3: Revenue Quality — contradiction 1 ---
    {
      id: 's3-b1',
      kind: 'heading',
      page: 3,
      section: 'Revenue Quality',
      text: 'Revenue Quality',
    },
    {
      id: 's3-b2',
      kind: 'kv',
      page: 3,
      section: 'Revenue Quality',
      text: 'Approximately 80% of FY24 revenue is recurring, underpinned by multi-year customer agreements with high renewal rates.',
    },
    {
      id: 's3-b3',
      kind: 'kv',
      page: 3,
      section: 'Revenue Quality',
      text: 'Revenue mix: Recurring / subscription 80%, Project-based 20%.',
    },

    // --- Slide 4: Financial summary ---
    {
      id: 's4-b1',
      kind: 'heading',
      page: 4,
      section: 'Financial Summary',
      text: 'Financial Summary',
    },
    {
      id: 's4-b2',
      kind: 'table',
      page: 4,
      section: 'Financial Summary',
      text: 'FY22 Revenue $34.2m (57.8% gross margin, $5.9m EBITDA at 17.3% margin). FY23 Revenue $39.6m, up 15.8% (58.9% gross margin, $7.6m EBITDA at 19.2% margin). FY24 Revenue $45.8m, up 15.7% (60.1% gross margin, $9.8m EBITDA at 21.4% margin).',
      table: {
        columns: ['', 'FY22', 'FY23', 'FY24'],
        rows: [
          ['Revenue ($m)', '34.2', '39.6', '45.8'],
          ['Revenue growth (%)', '—', '15.8%', '15.7%'],
          ['Gross margin (%)', '57.8%', '58.9%', '60.1%'],
          ['Adjusted EBITDA ($m)', '5.9', '7.6', '9.8'],
          ['EBITDA margin (%)', '17.3%', '19.2%', '21.4%'],
        ],
      },
    },

    // --- Slide 5: Customer base ---
    {
      id: 's5-b1',
      kind: 'heading',
      page: 5,
      section: 'Customer Base',
      text: 'Customer Base',
    },
    {
      id: 's5-b2',
      kind: 'bullet',
      page: 5,
      section: 'Customer Base',
      text: 'The customer base spans hospital systems, multi-specialty physician groups, and ambulatory surgery centers across North and South Carolina, anchored by long-term service agreements with several of the region\'s largest regional health networks.',
    },

    // --- Slide 6: Management team ---
    {
      id: 's6-b1',
      kind: 'paragraph',
      page: 6,
      section: 'Management Team',
      text: 'The senior leadership team averages 13 years in outpatient healthcare operations. CEO and co-founder Dana Whitfield and COO Marcus Ellery have led the business since its 2013 founding, supported by a CFO and VP of Clinical Operations who joined in 2019 and 2021, respectively.',
    },

    // --- Slide 7: Growth plan ---
    {
      id: 's7-b1',
      kind: 'paragraph',
      page: 7,
      section: 'Growth Plan',
      text: 'Growth strategy centers on same-site volume growth, de novo clinic openings in adjacent Carolinas metros, and selective tuck-in acquisitions of independent specialty practices.',
    },

    // --- Slide 8: Capitalisation summary — a pointer, not a restatement ---
    {
      id: 's8-b1',
      kind: 'kv',
      page: 8,
      section: 'Capitalization',
      text: 'Fully diluted shares outstanding: 7,850,000 (see accompanying Capitalization Table for detail).',
    },
  ],
};
