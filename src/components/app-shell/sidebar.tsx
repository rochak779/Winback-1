// ============================================================================
// src/components/app-shell/sidebar.tsx
//
// Replaces the top Stepper with a persistent left nav. Basic UI only — the
// visual design pass comes later; this just gets the navigation structure
// (Dashboard / New Deal / Ingest / Analysis / Decision / Knowledge Graph)
// and sign-out in place.
// ============================================================================

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { useIsMockRun, useRun } from '@/lib/store/RunProvider';

export function Sidebar() {
  const { run } = useRun();
  const isMock = useIsMockRun();
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await createBrowserSupabaseClient().auth.signOut();
    router.push('/sign-in');
  }

  const items: { label: string; href: string; disabled: boolean }[] = [
    { label: 'Dashboard', href: '/dashboard', disabled: false },
    { label: 'New Deal', href: '/plan', disabled: false },
    { label: 'Ingest', href: `/deal/${run.id}/ingest`, disabled: !run.deal },
    { label: 'Analysis', href: `/deal/${run.id}/analysis`, disabled: !run.deal },
    { label: 'Decision', href: `/deal/${run.id}/decision`, disabled: !run.deal },
    { label: 'Audit Trail', href: `/deal/${run.id}/audit`, disabled: !run.deal },
    { label: 'Knowledge Graph', href: '/graph', disabled: false },
  ];

  return (
    <nav className="flex h-full w-52 shrink-0 flex-col gap-6 border-r bg-background p-4">
      <div className="space-y-1">
        <Link href="/dashboard" className="font-heading text-sm font-semibold tracking-tight">
          WinBack
        </Link>
        {run.deal && <p className="truncate text-xs text-muted-foreground">{run.deal.name}</p>}
        {isMock && (
          <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30" variant="outline">
            MOCK
          </Badge>
        )}
      </div>

      <ul className="flex-1 space-y-0.5">
        {items.map((item) => {
          const active = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
          if (item.disabled) {
            return (
              <li key={item.label}>
                <span className="block rounded px-2 py-1.5 text-sm text-muted-foreground/50">{item.label}</span>
              </li>
            );
          }
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                className={cn(
                  'block rounded px-2 py-1.5 text-sm transition-colors hover:bg-muted',
                  active && 'bg-muted font-medium',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <Button variant="ghost" size="sm" className="justify-start" onClick={handleSignOut}>
        Sign out
      </Button>
    </nav>
  );
}
