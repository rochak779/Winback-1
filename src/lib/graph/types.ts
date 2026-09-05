import type { Deal, Run } from '@/lib/contracts/types';

/** Read-only projection of ERD §7.4 PersistedSession; accepts full saved sessions structurally.
 * This module does not introduce a second persistence model or store documents.
 */
export type GraphSession = Pick<Run, 'id' | 'extraction' | 'benchmark' | 'portfolio' | 'decision' | 'memo'> & {
  deal: Deal;
  updatedAt: string;
  historical?: boolean;
};

export type OwnedGraphSession = GraphSession & { userId: string };
