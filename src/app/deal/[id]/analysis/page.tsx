// ============================================================================
// src/app/deal/[id]/analysis/page.tsx — Screen 3: Benchmark + Portfolio Impact
//
// Real build is erd.md Phase 4 (§4.1–4.2) — the /api/benchmark and
// /api/portfolio routes don't exist yet. This route exists now so the app
// shell and stepper are complete per Phase 3 session 3.1; it becomes the
// real two-panel screen without changing this file's location.
// ============================================================================

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function AnalysisPage({ params }: PageProps<'/deal/[id]/analysis'>) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold tracking-tight">Benchmark + Portfolio Impact</h1>
        <p className="text-sm text-muted-foreground">
          Peer benchmarking and portfolio sector-concentration impact land here in the next build phase.
        </p>
      </div>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-sm">Coming next</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This screen will compare the target against three peer companies and show the effect of this
          deal on the fund&apos;s existing sector concentration.
        </CardContent>
      </Card>
      <Button nativeButton={false} render={<Link href={`/deal/${id}/decision`} />}>
        Skip to decision →
      </Button>
    </div>
  );
}
