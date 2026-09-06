'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { getUserOrgs } from '@/lib/org/membership';

export default function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setPending(false);
      setError(signInError.message);
      return;
    }
    // A confirmed-but-never-onboarded user (e.g. they signed up, confirmed by
    // email later, and are only now signing in for the first time) has no org
    // yet — send them through the wizard instead of straight to `next`/`/`.
    const orgs = data.user ? await getUserOrgs(supabase as never, data.user.id) : [];
    setPending(false);
    if (orgs.length === 0) {
      router.push('/onboarding');
      return;
    }
    // Only same-origin relative paths — never an attacker-supplied absolute URL.
    const next = searchParams.get('next');
    router.push(next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard');
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col justify-center py-16">
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Signing in…' : 'Sign in'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <a href="/forgot-password" className="underline">Forgot password?</a> ·{' '}
              No account? <a href="/sign-up" className="underline">Sign up</a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
