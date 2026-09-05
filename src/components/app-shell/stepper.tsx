// ============================================================================
// src/components/app-shell/stepper.tsx — erd.md Part 6 §6.3
//
// The spine of the demo narrative: Plan → Ingest → Analysis → Decision,
// each colored by its stage status, so a judge sees the four-layer
// architecture without being told.
// ============================================================================

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CheckIcon, LoaderCircleIcon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRun } from '@/lib/store/RunProvider';
import type { StageStatus } from '@/lib/contracts/types';

function combineStatus(a: StageStatus, b: StageStatus): StageStatus {
  if (a === 'error' || b === 'error') return 'error';
  if (a === 'running' || b === 'running') return 'running';
  if (a === 'done' && b === 'done') return 'done';
  return 'idle';
}

function StepDot({ status }: { status: StageStatus }) {
  if (status === 'done') return <CheckIcon className="size-3.5 text-stage-done" />;
  if (status === 'running') return <LoaderCircleIcon className="size-3.5 animate-spin text-stage-active" />;
  if (status === 'error') return <XIcon className="size-3.5 text-destructive" />;
  return <span className="size-1.5 rounded-full bg-muted-foreground/40" />;
}

export function Stepper() {
  const { run } = useRun();
  const pathname = usePathname();

  const planStatus: StageStatus = run.deal ? 'done' : 'idle';
  const analysisStatus = combineStatus(run.stages.benchmark.status, run.stages.portfolio.status);

  const steps: { label: string; href: string; status: StageStatus; disabled: boolean }[] = [
    { label: 'Plan', href: '/', status: planStatus, disabled: false },
    { label: 'Ingest', href: `/deal/${run.id}/ingest`, status: run.stages.extract.status, disabled: !run.deal },
    { label: 'Analysis', href: `/deal/${run.id}/analysis`, status: analysisStatus, disabled: !run.deal },
    { label: 'Decision', href: `/deal/${run.id}/decision`, status: run.stages.decision.status, disabled: !run.deal },
  ];

  return (
    <ol className="flex items-center gap-1.5 text-sm">
      {steps.map((step, i) => {
        const active = pathname === step.href || (step.href !== '/' && pathname.startsWith(step.href));
        return (
          <li key={step.label} className="flex items-center gap-1.5">
            {i > 0 && <span className="h-px w-4 bg-border" aria-hidden />}
            {step.disabled ? (
              <span className="flex items-center gap-1.5 rounded-full px-2 py-1 text-muted-foreground/60">
                <StepDot status={step.status} />
                {step.label}
              </span>
            ) : (
              <Link
                href={step.href}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors hover:bg-muted',
                  active ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                <StepDot status={step.status} />
                {step.label}
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}
