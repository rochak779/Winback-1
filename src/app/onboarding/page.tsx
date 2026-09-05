'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { createOrgForUser } from '@/lib/org/membership';
import { createInvite } from '@/lib/org/invites';

type Step = 'details' | 'company' | 'invite' | 'upload';

interface InviteRow {
  email: string;
  role: 'admin' | 'member';
  link: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  const [step, setStep] = useState<Step>('details');
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgId, setOrgId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleDetails(e: React.FormEvent) {
    e.preventDefault();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from('profiles').upsert({ id: data.user.id, full_name: fullName });
    setStep('company');
  }

  async function handleCompany(e: React.FormEvent) {
    e.preventDefault();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    try {
      const { orgId: newOrgId } = await createOrgForUser(supabase, data.user.id, orgName);
      setOrgId(newOrgId);
      setStep('invite');
    } catch {
      setError('Could not create the company. Try again.');
    }
  }

  async function handleAddInvite() {
    if (!orgId || !inviteEmail) return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { token } = await createInvite(supabase as never, { orgId, email: inviteEmail, role: inviteRole }, data.user.id);
    const link = `${window.location.origin}/invite/${token}`;
    setInvites((prev) => [...prev, { email: inviteEmail, role: inviteRole, link }]);
    setInviteEmail('');
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    if (companyName.trim()) {
      await supabase.from('companies').insert({ org_id: orgId, name: companyName.trim() });
    }
    router.push('/');
  }

  return (
    <div className="mx-auto max-w-lg py-16">
      <Card>
        <CardHeader>
          <CardTitle>
            {step === 'details' && 'Your details'}
            {step === 'company' && 'Company details'}
            {step === 'invite' && 'Invite teammates'}
            {step === 'upload' && 'Upload documents'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === 'details' && (
            <form className="space-y-4" onSubmit={handleDetails}>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <Button type="submit">Continue</Button>
            </form>
          )}

          {step === 'company' && (
            <form className="space-y-4" onSubmit={handleCompany}>
              <div className="space-y-2">
                <Label htmlFor="orgName">Company name</Label>
                <Input id="orgName" required value={orgName} onChange={(e) => setOrgName(e.target.value)} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit">Continue</Button>
            </form>
          )}

          {step === 'invite' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input placeholder="teammate@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'admin' | 'member')}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" onClick={handleAddInvite}>Add</Button>
              </div>
              <ul className="space-y-1 text-sm">
                {invites.map((invite) => (
                  <li key={invite.link} className="flex flex-col gap-1 rounded border p-2">
                    <span>{invite.email} — {invite.role}</span>
                    <code className="break-all text-xs text-muted-foreground">{invite.link}</code>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep('upload')}>Skip</Button>
                <Button onClick={() => setStep('upload')}>Continue</Button>
              </div>
            </div>
          )}

          {step === 'upload' && (
            <form className="space-y-4" onSubmit={handleUpload}>
              <div className="space-y-2">
                <Label htmlFor="companyName">A company to track (optional)</Label>
                <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. a portfolio company name" />
              </div>
              <Button type="submit">Finish</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
