// ============================================================================
// src/app/page.tsx — Public landing page
//
// The only page unauthenticated visitors can reach at "/" (see PUBLIC_PATHS
// in src/proxy.ts). Basic hero + CTA only — no data fetching, no visual
// design pass yet. The authenticated dashboard lives at /dashboard.
// ============================================================================

import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function LandingPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center gap-6 py-24 text-center">
      <h1 className="font-heading text-4xl font-semibold tracking-tight">WinBack</h1>
      <p className="text-lg text-muted-foreground">
        Autonomous first-pass diligence for private equity deal teams.
      </p>
      <div className="flex gap-3">
        <Link href="/sign-in" className={buttonVariants()}>Sign in</Link>
        <Link href="/sign-up" className={cn(buttonVariants({ variant: 'outline' }))}>Sign up</Link>
      </div>
    </div>
  );
}
