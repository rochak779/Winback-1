import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/', '/sign-in', '/sign-up', '/forgot-password', '/reset-password'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/invite/');
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  if (!data.user && !isPublic(pathname)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } },
        { status: 401 },
      );
    }
    const redirectUrl = new URL('/sign-in', request.url);
    redirectUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
