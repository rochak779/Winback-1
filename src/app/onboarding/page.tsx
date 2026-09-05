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

interface TrackedCompany {
  id: string;
  name: string;
  files: string[];
}

const DOCUMENT_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,application/pdf,application/msword,' +
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,' +
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,' +
  'application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain';

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
  const [trackedCompanies, setTrackedCompanies] = useState<TrackedCompany[]>([]);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDetails(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { error: upsertError } = await supabase.from('profiles').upsert({ id: data.user.id, full_name: fullName });
      if (upsertError) throw new Error(upsertError.message);
      setStep('company');
    } catch {
      setError('Could not save. Try again.');
    }
  }

  async function handleCompany(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    try {
      const { orgId: newOrgId } = await createOrgForUser(supabase as never, data.user.id, orgName);
      setOrgId(newOrgId);
      setStep('invite');
    } catch {
      setError('Could not create the company. Try again.');
    }
  }

  async function handleAddInvite() {
    if (!orgId || !inviteEmail) return;
    setError(null);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { token } = await createInvite(supabase as never, { orgId, email: inviteEmail, role: inviteRole }, data.user.id);
      const link = `${window.location.origin}/invite/${token}`;
      setInvites((prev) => [...prev, { email: inviteEmail, role: inviteRole, link }]);
      setInviteEmail('');
    } catch {
      setError('Could not save. Try again.');
    }
  }

  async function handleAddCompany() {
    if (!orgId || !companyName.trim()) return;
    setError(null);
    try {
      const { data, error: insertError } = await supabase
        .from('companies')
        .insert({ org_id: orgId, name: companyName.trim() })
        .select()
        .single();
      if (insertError || !data) throw new Error(insertError?.message ?? 'Failed to create company');
      setTrackedCompanies((prev) => [...prev, { id: data.id, name: data.name, files: [] }]);
      setCompanyName('');
    } catch {
      setError('Could not add the company. Try again.');
    }
  }

  async function handleUploadFiles(companyId: string, fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !orgId) return;
    setUploadingFor(companyId);
    setError(null);
    try {
      for (const file of Array.from(fileList)) {
        const path = `${orgId}/${companyId}/${file.name}`;
        const { error: uploadError } = await supabase.storage.from('company-documents').upload(path, file, { upsert: true });
        if (uploadError) throw new Error(uploadError.message);
      }
      const names = Array.from(fileList).map((file) => file.name);
      setTrackedCompanies((prev) =>
        prev.map((company) =>
          company.id === companyId ? { ...company, files: [...company.files, ...names] } : company,
        ),
      );
    } catch {
      setError('Could not upload the file. Try again.');
    } finally {
      setUploadingFor(null);
    }
  }

  function handleFinish(e: React.FormEvent) {
    e.preventDefault();
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
            {step === 'upload' && 'Companies to track'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === 'details' && (
            <form className="space-y-4" onSubmit={handleDetails}>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
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
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep('upload')}>Skip</Button>
                <Button onClick={() => setStep('upload')}>Continue</Button>
              </div>
            </div>
          )}

          {step === 'upload' && (
            <form className="space-y-4" onSubmit={handleFinish}>
              <div className="space-y-2">
                <Label htmlFor="companyName">Add a company to track (optional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. a portfolio company name"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCompany();
                      }
                    }}
                  />
                  <Button type="button" onClick={handleAddCompany}>Add</Button>
                </div>
              </div>

              {trackedCompanies.length > 0 && (
                <ul className="space-y-3">
                  {trackedCompanies.map((company) => (
                    <li key={company.id} className="space-y-2 rounded border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{company.name}</span>
                        <Input
                          type="file"
                          multiple
                          accept={DOCUMENT_ACCEPT}
                          className="w-auto max-w-56"
                          disabled={uploadingFor === company.id}
                          onChange={(e) => handleUploadFiles(company.id, e.target.files)}
                        />
                      </div>
                      {uploadingFor === company.id && <p className="text-xs text-muted-foreground">Uploading…</p>}
                      {company.files.length > 0 && (
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {company.files.map((fileName) => (
                            <li key={fileName}>{fileName}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit">Finish</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
