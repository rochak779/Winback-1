import type { Metadata } from 'next';
import { GraphExplorer } from '@/components/graph/GraphExplorer';
import { SEED_DOCS, SEED_SESSIONS } from '@/data/seed-sessions';
import { TARGET_DOCS } from '@/data/target';

export const metadata: Metadata = { title: 'Knowledge graph | WinBack', description: 'Explore cited evidence and shared counterparties across diligence sessions.' };

export default async function GraphPage({ searchParams }: {
  searchParams: Promise<{ demo?: string; sessionId?: string }>;
}) {
  const params = await searchParams;
  const historical = params.demo === '1';
  return <GraphExplorer historical={historical} docs={historical ? SEED_DOCS : TARGET_DOCS}
    initialSessionId={params.sessionId ?? (historical ? SEED_SESSIONS[0]!.id : '')} />;
}
