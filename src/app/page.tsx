// ============================================================================
// src/app/page.tsx — Dashboard
//
// Landing page after sign-in/onboarding. Basic UI only — the visual design
// pass comes later from the designer; this just surfaces real data:
// the org's tracked companies (src/data/target's onboarding-created
// `companies` rows) and the documents uploaded against each in Supabase
// Storage's `company-documents` bucket. No extraction pipeline wiring yet —
// see docs/superpowers/specs/2026-09-05-auth-onboarding-foundation-design.md.
// ============================================================================

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { getUserOrgs } from '@/lib/org/membership';

interface CompanyRow {
  id: string;
  name: string;
  files: string[];
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = createBrowserSupabaseClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        if (!cancelled) setLoading(false);
        return;
      }

      const orgs = await getUserOrgs(supabase as never, userData.user.id);
      const org = orgs[0];
      if (!org) {
        if (!cancelled) setLoading(false);
        return;
      }
      if (!cancelled) setOrgName(org.orgName);

      const { data: companyRows } = await supabase.from('companies').select('id, name').eq('org_id', org.orgId);
      const rows: CompanyRow[] = [];
      for (const company of companyRows ?? []) {
        const { data: files } = await supabase.storage.from('company-documents').list(`${org.orgId}/${company.id}`);
        rows.push({ id: company.id, name: company.name, files: (files ?? []).map((file) => file.name) });
      }
      if (!cancelled) {
        setCompanies(rows);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Dashboard</h1>
          {orgName && <p className="text-sm text-muted-foreground">{orgName}</p>}
        </div>
        <Link href="/plan" className={buttonVariants()}>New deal →</Link>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!loading && companies.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No companies tracked yet.
          </CardContent>
        </Card>
      )}

      {!loading && companies.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {companies.map((company) => (
            <Card key={company.id}>
              <CardHeader>
                <CardTitle className="text-base">{company.name}</CardTitle>
              </CardHeader>
              <CardContent>
                {company.files.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
                ) : (
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {company.files.map((fileName) => (
                      <li key={fileName}>{fileName}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
