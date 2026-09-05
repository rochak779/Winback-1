// ============================================================================
// src/app/plan/page.tsx — Screen 1: Plan (erd.md Part 6 §6.4)
//
// Moved from `/` to `/plan` when `/` became the org Dashboard. Reached via
// the sidebar's "New Deal" link.
// ============================================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TARGET_COMPANY_IDENTITY } from '@/data/target';
import { fetchDocs } from '@/lib/client/api';
import { useRun } from '@/lib/store/RunProvider';
import type { Deal } from '@/lib/contracts/types';

const THESIS_PRESETS = [
  "Regional imaging and specialty-care platform with a clean acquisition history — evaluate for a healthcare services roll-up, focused on revenue durability and clinician retention through a change of control.",
  "Bolt-on candidate for our existing outpatient healthcare portfolio: assess overlap with current holdings, pricing power with payers, and whether reported growth is organic or acquisition-driven.",
  "Standalone platform investment — underwrite on recurring revenue quality, cap table cleanliness ahead of a Series-style raise, and readiness for a buy-and-build strategy in the Southeast.",
];

function IdentityBlock() {
  return (
    <div className="mb-8 max-w-2xl space-y-2">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">WinBack</h1>
      <p className="text-sm text-muted-foreground">
        Autonomous first-pass diligence for PE deal teams. Load a target&apos;s documents and WinBack{' '}
        <strong className="text-foreground">extracts</strong> a structured profile,{' '}
        <strong className="text-foreground">benchmarks</strong> it against peers and your portfolio, and{' '}
        <strong className="text-foreground">cross-checks</strong> management&apos;s claims against the underlying evidence
        — every statement linked back to its source.
      </p>
    </div>
  );
}

export default function PlanPage() {
  const router = useRouter();
  const { dispatch } = useRun();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState<string>('Project Kestrel');
  const [targetCompany, setTargetCompany] = useState<string>(TARGET_COMPANY_IDENTITY.name);
  const [dealSizeUsdM, setDealSizeUsdM] = useState<string>(String(TARGET_COMPANY_IDENTITY.dealSizeUsdM));
  const [thesis, setThesis] = useState<string>(THESIS_PRESETS[0] ?? '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedDealSize = Number(dealSizeUsdM);
    if (!thesis.trim()) {
      toast.error('Add an investment thesis before creating the deal.');
      return;
    }
    const id = nanoid();
    const deal: Deal = {
      id,
      name,
      targetCompany,
      sector: TARGET_COMPANY_IDENTITY.sector,
      thesis,
      dealSizeUsdM: Number.isFinite(parsedDealSize) ? parsedDealSize : TARGET_COMPANY_IDENTITY.dealSizeUsdM,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'SET_DEAL', deal });

    startTransition(async () => {
      const docs = await fetchDocs(dispatch);
      if (!docs) {
        toast.error('Could not load the target’s documents. You can retry from the Ingest screen.');
      }
      router.push(`/deal/${id}/ingest`);
    });
  }

  return (
    <div>
      <IdentityBlock />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Create deal</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="deal-name">Deal codename</Label>
                <Input id="deal-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="target-company">Target company</Label>
                <Input id="target-company" value={targetCompany} onChange={(e) => setTargetCompany(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sector">Sector</Label>
                <Select value={TARGET_COMPANY_IDENTITY.sector} disabled>
                  <SelectTrigger id="sector" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TARGET_COMPANY_IDENTITY.sector}>{TARGET_COMPANY_IDENTITY.sector}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="deal-size">Deal size (USD millions)</Label>
                <Input
                  id="deal-size"
                  type="number"
                  inputMode="decimal"
                  value={dealSizeUsdM}
                  onChange={(e) => setDealSizeUsdM(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="thesis">Investment thesis</Label>
              <Textarea id="thesis" value={thesis} onChange={(e) => setThesis(e.target.value)} rows={4} required />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {THESIS_PRESETS.map((preset, i) => (
                  <Button key={i} type="button" variant="outline" size="xs" onClick={() => setThesis(preset)}>
                    Preset {i + 1}
                  </Button>
                ))}
              </div>
            </div>

            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating deal…' : 'Create deal →'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
