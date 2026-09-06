// ============================================================================
// src/components/app-shell/app-shell.tsx
//
// Hides the sidebar (and its Sign out button) on public/unauthenticated
// pages — there's no session yet on /, /sign-in, /sign-up, /forgot-password,
// /reset-password, or /invite/[token], so nav for a signed-in workspace
// doesn't belong there.
// ============================================================================

'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/app-shell/sidebar';

const PUBLIC_PATHS = ['/', '/sign-in', '/sign-up', '/forgot-password', '/reset-password'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/invite/');
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showSidebar = !isPublicPath(pathname);

  return (
    <div className="flex min-h-full flex-1">
      {showSidebar && <Sidebar />}
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
