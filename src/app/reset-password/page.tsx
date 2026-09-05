'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // null = still checking, true/false = confirmed. Supabase puts the recovery
  // session in this browser's storage, so a link opened elsewhere has none.
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    createBrowserSupabaseClient()
      .auth.getSession()
      .then(({ data }) => {
        if (active) setHasSession(Boolean(data.session));
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.push('/sign-in');
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col justify-center py-16">
      <Card>
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
        </CardHeader>
        <CardContent>
          {hasSession === null && <p className="text-sm text-muted-foreground">Checking your reset link…</p>}
          {hasSession === false && (
            <p className="text-sm text-muted-foreground">
              This link must be opened in the same browser you requested it from.{' '}
              <a href="/forgot-password" className="underline">Request a new link.</a>
            </p>
          )}
          {hasSession === true && (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Saving…' : 'Save new password'}
            </Button>
          </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
