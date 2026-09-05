// ============================================================================
// src/components/ingest/profile-view.tsx — erd.md Part 6 §6.5
//
// The structured company profile: financials, revenue mix, contracts, cap
// table, option grants, key terms. Every value with evidence gets a chip;
// everything else renders `—`. The contracts table's notice-period column
// is shown but never flagged here — that finding belongs to the Decision
// screen (Part 6 §6.5, §6.7).
// ============================================================================

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EvidenceValue } from '@/components/evidence/evidence-chip';
import type { CompanyProfile } from '@/lib/contracts/types';

function fmtUsdM(n: number | null): string {
  return n === null ? '—' : `$${n.toFixed(1)}m`;
}

function fmtPct(n: number | null): string {
  return n === null ? '—' : `${n.toFixed(1)}%`;
}

export function ProfileView({ profile }: { profile: CompanyProfile }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{profile.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Sector</dt>
              <dd>{profile.sector}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">HQ</dt>
              <dd>{profile.hq ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Founded</dt>
              <dd>{profile.foundedYear ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Employees</dt>
              <dd className="tabular-nums">{profile.employees ?? '—'}</dd>
            </div>
          </dl>
          <p className="text-sm text-muted-foreground">{profile.businessSummary}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Financials</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>FY</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Growth</TableHead>
                <TableHead className="text-right">Gross margin</TableHead>
                <TableHead className="text-right">EBITDA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profile.financials.map((fy) => (
                <TableRow key={fy.fy}>
                  <TableCell className="font-medium">{fy.fy}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <EvidenceValue value={fmtUsdM(fy.revenueUsdM)} refs={fy.evidence} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPct(fy.revenueGrowthPct)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPct(fy.grossMarginPct)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtUsdM(fy.ebitdaUsdM)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {profile.revenueMix.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Revenue mix</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            {profile.revenueMix.map((item) => (
              <div key={item.label} className="text-sm">
                <div className="text-xs text-muted-foreground">{item.label}</div>
                <div className="tabular-nums">
                  <EvidenceValue value={fmtPct(item.pct)} refs={item.evidence} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Customer contracts</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Annual value</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Auto-renew</TableHead>
                <TableHead>Notice period</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profile.contracts.map((c) => (
                <TableRow key={c.customer}>
                  <TableCell className="font-medium">{c.customer}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <EvidenceValue value={fmtUsdM(c.annualValueUsdM)} refs={c.evidence} />
                  </TableCell>
                  <TableCell>{c.termMonths ? `${c.termMonths} mo` : '—'}</TableCell>
                  <TableCell>{c.autoRenew === null ? '—' : c.autoRenew ? 'Yes' : 'No'}</TableCell>
                  <TableCell>{c.cancellationNoticeDays !== null ? `${c.cancellationNoticeDays} days` : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cap table</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Stated fully diluted shares:{' '}
            <span className="tabular-nums text-foreground">
              {profile.statedFullyDilutedShares !== null ? profile.statedFullyDilutedShares.toLocaleString() : '—'}
            </span>
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Holder</TableHead>
                <TableHead>Class</TableHead>
                <TableHead className="text-right">Shares</TableHead>
                <TableHead className="text-right">% fully diluted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profile.capTable.map((row) => (
                <TableRow key={`${row.holder}-${row.securityClass}`}>
                  <TableCell className="font-medium">{row.holder}</TableCell>
                  <TableCell>{row.securityClass}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <EvidenceValue value={row.shares.toLocaleString()} refs={row.evidence} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPct(row.pctFullyDiluted)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Option grants</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grantee</TableHead>
                <TableHead>Board approval</TableHead>
                <TableHead className="text-right">Options</TableHead>
                <TableHead className="text-right">Strike</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profile.optionGrants.map((g) => (
                <TableRow key={`${g.grantee}-${g.boardApprovalDate}`}>
                  <TableCell className="font-medium">{g.grantee}</TableCell>
                  <TableCell>{g.boardApprovalDate}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <EvidenceValue value={g.options.toLocaleString()} refs={g.evidence} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{g.strikeUsd !== null ? `$${g.strikeUsd.toFixed(2)}` : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {profile.keyTerms.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Key terms</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {profile.keyTerms.map((term) => (
              <div key={term.label} className="text-sm">
                <div className="text-xs text-muted-foreground">{term.label}</div>
                <EvidenceValue value={term.value} refs={term.evidence} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
