# Phase 6.3 — Audit Trail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every pipeline run a durable, per-user audit trail — every stage start/completion/failure, every generated statement (with its existing provenance), every analyst accept/dismiss/edit, and every memo status change — persisted in Postgres so it survives sign-out/sign-in, plus an audit view and "ƒ" derived-value markers on the six numbers a reviewer will interrogate.

**Architecture:** Two new Supabase tables (`runs` as a lightweight anchor, `run_audit` as an append-only log) owned by the signed-in user. A single `recordAudit()` helper (mirroring the existing `src/lib/org/invites.ts` dependency-injection style for testability) is the only thing that writes to `run_audit`, called from every pipeline route (server-side truth: stage lifecycle + statement provenance) and from one new `POST /api/audit/event` route (client-triggered: analyst decisions, memo status, "viewed an old run"). Reads go through a new `GET /api/runs/[id]/audit` (+ `/export`), built with the same handler-factory pattern already used in `src/lib/graph/http.ts` so it's unit-testable without a real database. The audit page is deliberately **not** wrapped by the client-only `DealGate`/localStorage rehydration — it reads straight from the server — so a user can sign out, sign back in on the same or a different browser, and still see the trail for any run they own.

**Tech Stack:** Next.js App Router (Node runtime), Supabase Postgres + `@supabase/ssr`, Zod contracts, Vitest.

**Spec:** `../../../erd.md` Part 9 (Audit Trail & Provenance, full text) and Part 3 §3.9 (already-frozen `AuditEntry`/`Provenance`/`Stage`/`StatementId` types in `src/lib/contracts/schemas.ts` / `types.ts`).

## Global Constraints

- **Scope is deliberately smaller than erd.md Part 9 assumes.** The plan assumes a Firestore `sessions/{id}` document already exists (Phase 6.2, saved sessions — not built). This plan adds only the minimal Postgres anchor (`runs`) needed to attach audit entries to; it does **not** persist pipeline output, does not build `/deals` history, and does not add autosave. This was confirmed with the user directly.
- **Append-only.** No route ever issues `UPDATE` or `DELETE` on `run_audit`. RLS grants only `SELECT`/`INSERT` to the owner — no update/delete policy exists at all, so those operations are denied by default.
- **Fire-and-forget in spirit, awaited in fact.** `recordAudit()` never throws and a failed write never fails a pipeline call — but unlike the literal erd.md text ("`void recordAudit(...)`, never awaited"), this plan **awaits it internally** inside each route handler before the response is returned. Vercel-style serverless functions can freeze a function's execution context immediately after the response is sent, so a truly un-awaited write is not reliably durable there. Errors are still caught and logged, never propagated — same availability-over-completeness guarantee, safer transport.
- **Never log raw source-document text** beyond what's already in an `EvidenceRef.quote`, and never log a prompt body — only `promptVersion`. (Already true of everything wired in below: only model-generated statement text and existing evidence refs are logged.)
- `entryId` format: `${Date.now().toString(36)}-${nanoid(6)}` — sortable lexicographically, no separate index needed for time ordering (erd.md §9.2).
- Existing repo conventions to follow: `snake_case` DB columns mapped manually to camelCase in code (no generated Supabase types exist — see `src/lib/org/invites.ts`), dependency-injected "Xy­Like" interfaces for anything hitting Supabase so it stays unit-testable without a live DB (see `src/lib/graph/http.ts`, `src/lib/org/invites.ts`), no `.tsx` component tests exist in this repo — only `.ts` lib/route tests — so this plan doesn't add any either, matching convention.

---

## File Structure

New files:
- `supabase/migrations/0004_audit_trail.sql` — `runs`, `run_audit`, RLS.
- `src/lib/audit/record.ts` + `record.test.ts` — the only write path.
- `src/lib/audit/read.ts` + `read.test.ts` — handler-factory pattern for list/export, DI-testable.
- `src/app/api/audit/event/route.ts` — client-triggered audit events.
- `src/app/api/runs/[id]/audit/route.ts` — GET list, wires `read.ts` to real Supabase.
- `src/app/api/runs/[id]/audit/export/route.ts` — GET export.
- `src/components/ui/popover.tsx` — base-ui popover primitive (click-to-reveal), mirrors `tooltip.tsx`.
- `src/components/audit/derived-marker.tsx` — the "ƒ" marker + popover.
- `src/components/audit/audit-timeline.tsx` — the reverse-chronological list + filters + export button.
- `src/app/deal/[id]/audit/page.tsx` — the audit view, NOT under `DealGate`.
- `src/app/deal/[id]/(pipeline)/layout.tsx` — moved from `src/app/deal/[id]/layout.tsx` (DealGate wrapper), now scoped only to the three pipeline screens.

Moved files (mechanical, no logic changes):
- `src/app/deal/[id]/ingest/*` → `src/app/deal/[id]/(pipeline)/ingest/*`
- `src/app/deal/[id]/analysis/*` → `src/app/deal/[id]/(pipeline)/analysis/*`
- `src/app/deal/[id]/decision/*` → `src/app/deal/[id]/(pipeline)/decision/*`

Modified files:
- `src/lib/contracts/schemas.ts` / `types.ts` — add `NOT_FOUND` error code, `runId` on the five request schemas, `AuditClientActionSchema` + `AuditEventRequestSchema`/`ResponseSchema`, `AuditListResponseSchema`.
- `src/lib/pipeline/http.ts` — `statusForCode` gets `NOT_FOUND → 404`; `withRoute`'s handler now receives the already-fetched `userId`.
- `src/app/api/extract/route.ts`, `benchmark/route.ts`, `portfolio/route.ts`, `crosscheck/route.ts`, `memo/route.ts` — accept `runId`, call `recordAudit`.
- `src/lib/client/api.ts` — thread `runId` through the five `run*` functions; add `recordAuditEvent()`.
- `src/app/deal/[id]/(pipeline)/ingest/page.tsx`, `analysis/page.tsx`, `decision/page.tsx` — pass `run.id`.
- `src/components/decision/crosscheck-card.tsx`, `memo-card.tsx` — call `recordAuditEvent` on analyst actions.
- `src/components/app-shell/deal-gate.tsx` — call `recordAuditEvent(..., 'session_viewed')` on rehydrate.
- `src/components/app-shell/sidebar.tsx` — add "Audit Trail" nav item.
- `src/lib/labels.ts` — add `AUDIT_ACTION_LABEL`, `ACTOR_LABEL`.
- `src/components/analysis/benchmark-panel.tsx`, `portfolio-panel.tsx`, `src/components/decision/crosscheck-card.tsx` — add `<DerivedMarker>` on the six numbers.

---

## Task 1: Database schema — `runs` and `run_audit`

**Files:**
- Create: `supabase/migrations/0004_audit_trail.sql`

**Interfaces:**
- Produces: tables `runs(id text pk, user_id uuid, created_at timestamptz)` and `run_audit(id text pk, run_id text fk→runs.id, user_id uuid, at timestamptz, actor text, action text, stage text, statement_id text, statement_text text, evidence jsonb, provenance jsonb, before text, after text, note text)`.

- [ ] **Step 1: Write the migration**

```sql
-- 0004_audit_trail.sql
--
-- Phase 6.3 — Audit trail. `runs` is a lightweight anchor row (the pipeline's
-- actual output stays client-side/localStorage — Phase 6.2 saved sessions is
-- not in scope); `run_audit` is the append-only log. Both are owned solely by
-- the creating user — the pipeline has no org/company concept yet, so this
-- does not attempt to piggyback on the orgs/companies tables from
-- 0001_auth_foundation.sql.

create table runs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table runs enable row level security;

create policy "runs: owner all" on runs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table run_audit (
  id text primary key,
  run_id text not null references runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  at timestamptz not null default now(),
  actor text not null check (actor in ('system', 'model', 'analyst')),
  action text not null check (action in (
    'stage_started', 'stage_completed', 'stage_failed', 'statement_generated',
    'evidence_dropped', 'analyst_accepted', 'analyst_dismissed', 'analyst_edited',
    'memo_status_changed', 'session_created', 'session_viewed', 'session_deleted'
  )),
  stage text check (stage in ('extract', 'benchmark', 'portfolio', 'decision', 'memo')),
  statement_id text,
  statement_text text,
  evidence jsonb not null default '[]'::jsonb,
  provenance jsonb,
  before text,
  after text,
  note text
);

alter table run_audit enable row level security;

-- Append-only: SELECT + INSERT policies only. No UPDATE/DELETE policy exists,
-- so those operations are denied by default under RLS — this is the "policy,
-- not storage guarantee" append-only property erd.md Part 9.2 calls for.
create policy "run_audit: owner read" on run_audit for select
  using (user_id = auth.uid());

create policy "run_audit: owner insert" on run_audit for insert
  with check (user_id = auth.uid());

-- Entries sort lexicographically by time via `id` alone (erd.md §9.2), but an
-- index still speeds "give me this run's entries newest first."
create index run_audit_run_id_id_idx on run_audit (run_id, id desc);
```

- [ ] **Step 2: Apply it**

Run: `cd /Users/rochakagarwal/orca/projects/Winback/winback && npx supabase db push`

Expected: migration applies cleanly against the linked project (confirm with `npx supabase migration list` showing `0004_audit_trail` applied).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0004_audit_trail.sql
git commit -m "feat(audit): add runs and run_audit tables"
```

---

## Task 2: Contract additions — `NOT_FOUND`, `runId`, audit request/response schemas

**Files:**
- Modify: `src/lib/contracts/schemas.ts`
- Modify: `src/lib/contracts/types.ts`
- Modify: `src/lib/pipeline/http.ts:16-30` (`statusForCode`)

**Interfaces:**
- Consumes: existing `AuditActionSchema`, `AuditEntrySchema`, `StageSchema`, `StatementIdSchema`, `ApiResponseSchema` (all already defined).
- Produces: `AuditClientActionSchema`, `AuditEventRequestSchema`, `AuditEventResponseSchema`, `AuditListResponseSchema` (schemas) and `AuditClientAction`, `AuditEventRequest`, `AuditListResponse` (types) — later tasks import these exact names.

- [ ] **Step 1: Add `NOT_FOUND` to the error code enum**

In `src/lib/contracts/schemas.ts`, find `ErrorCodeSchema` (around line 406) and add the new member:

```ts
export const ErrorCodeSchema = z.enum([
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'RATE_LIMITED',
  'LLM_ERROR',
  'LLM_TIMEOUT',
  'CONTRACT_VIOLATION',
  'INTERNAL',
]);
```

- [ ] **Step 2: Map it to a status code**

In `src/lib/pipeline/http.ts`, in `statusForCode`, add:

```ts
    case 'UNAUTHORIZED':
      return 401;
    case 'NOT_FOUND':
      return 404;
    case 'RATE_LIMITED':
```

- [ ] **Step 3: Add `runId` to the five pipeline request schemas**

In `src/lib/contracts/schemas.ts`, find each of these (around lines 471-487) and add `runId: z.string()` as the first field:

```ts
export const ExtractRequestSchema = z.object({ runId: z.string(), docIds: z.array(SourceDocIdSchema) });
export const BenchmarkRequestSchema = z.object({ runId: z.string(), profile: CompanyProfileSchema });
export const PortfolioRequestSchema = z.object({ runId: z.string(), profile: CompanyProfileSchema, dealSizeUsdM: z.number() });
export const CrosscheckRequestSchema = z.object({ runId: z.string(), docIds: z.array(SourceDocIdSchema), profile: CompanyProfileSchema });
export const MemoRequestSchema = z.object({
  runId: z.string(),
  deal: DealSchema,
  profile: CompanyProfileSchema,
  benchmark: BenchmarkResultSchema,
  portfolio: PortfolioImpactSchema,
  crosschecks: z.array(CrosscheckSchema),
});
```

(Check the exact current field lists for `BenchmarkRequestSchema`/`PortfolioRequestSchema`/`CrosscheckRequestSchema` in the file before editing — only `runId` is being added, every existing field stays.)

- [ ] **Step 4: Add the audit event and list schemas**

Append near the end of `src/lib/contracts/schemas.ts`, after `AuditEntrySchema`:

```ts
// ----------------------------------------------------------------------------
// Audit trail — client-triggered events and read responses (Phase 6.3)
// ----------------------------------------------------------------------------

/** Actions a client is trusted to report itself — stage lifecycle and
 * statement_generated are always server-computed, never accepted from a client. */
export const AuditClientActionSchema = z.enum([
  'analyst_accepted',
  'analyst_dismissed',
  'analyst_edited',
  'memo_status_changed',
  'session_viewed',
]);

export const AuditEventRequestSchema = z.object({
  runId: z.string(),
  action: AuditClientActionSchema,
  stage: StageSchema.nullable().default(null),
  statementId: StatementIdSchema.nullable().default(null),
  statementText: z.string().nullable().default(null),
  before: z.string().nullable().default(null),
  after: z.string().nullable().default(null),
  note: z.string().nullable().default(null),
});

export const AuditEventResponseSchema = ApiResponseSchema(z.object({ recorded: z.literal(true) }));

export const AuditListResponseSchema = ApiResponseSchema(
  z.object({
    entries: z.array(AuditEntrySchema),
    nextCursor: z.string().nullable(),
  }),
);
```

- [ ] **Step 5: Export the types**

In `src/lib/contracts/types.ts`, in the `// 3.9 Audit trail` block, add:

```ts
export type AuditAction = z.infer<typeof S.AuditActionSchema>;
export type AuditEntry = z.infer<typeof S.AuditEntrySchema>;
export type AuditClientAction = z.infer<typeof S.AuditClientActionSchema>;
export type AuditEventRequest = z.infer<typeof S.AuditEventRequestSchema>;
export type AuditListResponse = z.infer<typeof S.AuditListResponseSchema>;
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`

Expected: fails at the five pipeline route files (they call the old, now-`runId`-short request shape implicitly via the client) — that's expected and fixed in later tasks. Confirm the *only* new errors are about missing `runId`, not anything else (e.g. no errors in files this task didn't touch).

- [ ] **Step 7: Commit**

```bash
git add src/lib/contracts/schemas.ts src/lib/contracts/types.ts src/lib/pipeline/http.ts
git commit -m "feat(audit): extend contracts with NOT_FOUND, runId, and audit event/list schemas"
```

---

## Task 3: `withRoute` passes `userId` to the handler

**Files:**
- Modify: `src/lib/pipeline/http.ts:78-107` (`withRoute`)
- Modify: `src/app/api/extract/route.ts`, `benchmark/route.ts`, `portfolio/route.ts`, `crosscheck/route.ts`, `memo/route.ts` (only the handler's signature line)

**Interfaces:**
- Produces: `withRoute(req, routeName, type, handler: (userId: string) => Promise<NextResponse>, options?)` — every pipeline route's inner `async () => {` becomes `async (userId) => {`; `userId` is `''` only when `requireAuth: false` is explicitly passed (no current pipeline route does).

- [ ] **Step 1: Change `withRoute`'s signature and body**

In `src/lib/pipeline/http.ts`:

```ts
export async function withRoute(
  req: Request,
  routeName: string,
  type: 'llm' | 'standard',
  handler: (userId: string) => Promise<NextResponse>,
  options: WithRouteOptions = {},
): Promise<NextResponse> {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'anonymous';
    await checkRateLimit(ip, type);
    let userId = '';
    if (options.requireAuth !== false) {
      const id = await getUserId();
      if (!id) return apiError('UNAUTHORIZED', 'Sign in required');
      userId = id;
    }
    return await handler(userId);
  } catch (err: unknown) {
    if (err instanceof RateLimitError) {
      return apiError('RATE_LIMITED', err.message, undefined, err.retryAfterSec);
    }
    console.error('[winback]', routeName, err);
    return apiError('INTERNAL', 'An unexpected error occurred');
  }
}
```

- [ ] **Step 2: Update every pipeline route's handler signature**

In each of `src/app/api/extract/route.ts`, `benchmark/route.ts`, `portfolio/route.ts`, `crosscheck/route.ts`, `memo/route.ts`, change:

```ts
  return withRoute(req, '<name>', 'llm', async () => {
```
to:
```ts
  return withRoute(req, '<name>', 'llm', async (userId) => {
```

(`userId` is unused for now in this task — that's fine, later tasks in this plan consume it. Don't add an eslint-disable; it'll be used before this compiles clean.)

- [ ] **Step 3: Typecheck and run the existing test suite**

Run: `npm run typecheck && npm test`

Expected: typecheck still fails only on the `runId`-shape gap from Task 2 (not on anything in this task); `npm test` passes — no existing test calls `withRoute`'s handler directly with a fixed arity, so this is non-breaking. (`src/lib/graph/http.ts`'s own `createGraphHandler` is unrelated and untouched.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/pipeline/http.ts src/app/api/extract/route.ts src/app/api/benchmark/route.ts src/app/api/portfolio/route.ts src/app/api/crosscheck/route.ts src/app/api/memo/route.ts
git commit -m "refactor(http): withRoute passes the already-fetched userId to handlers"
```

---

## Task 4: `recordAudit()` — the only write path

**Files:**
- Create: `src/lib/audit/record.ts`
- Test: `src/lib/audit/record.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks except the `AuditAction`/`Actor`/`Stage`/`Provenance`/`EvidenceRef` types from `@/lib/contracts/types` (already exist).
- Produces: `recordAudit(supabase: AuditSupabaseLike, entries: AuditEntryDraft | AuditEntryDraft[]): Promise<void>` and `newAuditId(): string` — every later task that writes an audit entry imports these two names from `@/lib/audit/record`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/audit/record.test.ts
import { describe, expect, it, vi } from 'vitest';
import { recordAudit, newAuditId, type AuditSupabaseLike } from './record';

function fixture() {
  const upsertCalls: unknown[] = [];
  const insertCalls: unknown[] = [];
  const supabase: AuditSupabaseLike = {
    from: (table: string) => ({
      upsert: vi.fn(async (row: unknown) => {
        upsertCalls.push({ table, row });
        return { error: null };
      }),
      insert: vi.fn(async (rows: unknown) => {
        insertCalls.push({ table, rows });
        return { error: null };
      }),
    }),
  };
  return { supabase, upsertCalls, insertCalls };
}

describe('newAuditId', () => {
  it('is a monotonically-sortable base36-time-prefixed id', () => {
    const a = newAuditId();
    const b = newAuditId();
    expect(a).toMatch(/^[0-9a-z]+-[A-Za-z0-9_-]{6}$/);
    expect(a <= b).toBe(true);
  });
});

describe('recordAudit', () => {
  it('upserts the run row once, then inserts one row per entry', async () => {
    const { supabase, upsertCalls, insertCalls } = fixture();
    await recordAudit(supabase, [
      { runId: 'run-1', userId: 'user-1', actor: 'system', action: 'stage_started', stage: 'extract' },
      { runId: 'run-1', userId: 'user-1', actor: 'model', action: 'statement_generated', stage: 'extract', statementId: 'run-1:extract:profile' },
    ]);
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0]).toMatchObject({ table: 'runs', row: { id: 'run-1', user_id: 'user-1' } });
    expect(insertCalls).toHaveLength(1);
    const rows = (insertCalls[0] as { rows: Record<string, unknown>[] }).rows;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ run_id: 'run-1', user_id: 'user-1', actor: 'system', action: 'stage_started', stage: 'extract' });
    expect(rows[1]).toMatchObject({ statement_id: 'run-1:extract:profile' });
  });

  it('is a no-op for an empty array', async () => {
    const { supabase, upsertCalls, insertCalls } = fixture();
    await recordAudit(supabase, []);
    expect(upsertCalls).toHaveLength(0);
    expect(insertCalls).toHaveLength(0);
  });

  it('never throws when the upsert or insert errors', async () => {
    const supabase: AuditSupabaseLike = {
      from: () => ({
        upsert: vi.fn(async () => ({ error: { message: 'boom' } })),
        insert: vi.fn(async () => ({ error: { message: 'boom' } })),
      }),
    };
    await expect(
      recordAudit(supabase, { runId: 'run-1', userId: 'user-1', actor: 'system', action: 'stage_started', stage: 'extract' }),
    ).resolves.toBeUndefined();
  });

  it('never throws when the client itself throws', async () => {
    const supabase: AuditSupabaseLike = {
      from: () => {
        throw new Error('network down');
      },
    };
    await expect(
      recordAudit(supabase, { runId: 'run-1', userId: 'user-1', actor: 'system', action: 'stage_started', stage: 'extract' }),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/audit/record.test.ts`
Expected: FAIL — `Cannot find module './record'`.

- [ ] **Step 3: Implement**

```ts
// src/lib/audit/record.ts
//
// The only place anything is written to `run_audit` (erd.md Part 9.3). Two
// deliberate departures from the literal spec text, both explained in the
// plan's Global Constraints: this is awaited by its caller (not `void`'d),
// and it targets Postgres/Supabase, not a Firestore subcollection.

import { nanoid } from 'nanoid';
import type { Actor, AuditAction, EvidenceRef, Provenance, Stage } from '@/lib/contracts/types';

/** Minimal Supabase surface this module needs — mirrors src/lib/org/invites.ts's
 * InvitesSupabaseLike so this stays unit-testable without a live database. */
export interface AuditSupabaseLike {
  from(table: string): {
    upsert: (row: Record<string, unknown>, opts?: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    insert: (rows: Record<string, unknown>[]) => Promise<{ error: { message: string } | null }>;
  };
}

export interface AuditEntryDraft {
  runId: string;
  userId: string;
  actor: Actor;
  action: AuditAction;
  stage: Stage | null;
  statementId?: string | null;
  statementText?: string | null;
  evidence?: EvidenceRef[];
  provenance?: Provenance | null;
  before?: string | null;
  after?: string | null;
  note?: string | null;
}

/** `${Date.now().toString(36)}-${nanoid(6)}` — sortable lexicographically by
 * time (erd.md §9.2), so `run_audit` never needs a separate time index. */
export function newAuditId(): string {
  return `${Date.now().toString(36)}-${nanoid(6)}`;
}

async function ensureRun(supabase: AuditSupabaseLike, runId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('runs')
    .upsert({ id: runId, user_id: userId }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) console.error('[winback] audit: failed to ensure run row', error.message);
}

function toRow(entry: AuditEntryDraft): Record<string, unknown> {
  return {
    id: newAuditId(),
    run_id: entry.runId,
    user_id: entry.userId,
    actor: entry.actor,
    action: entry.action,
    stage: entry.stage,
    statement_id: entry.statementId ?? null,
    statement_text: entry.statementText ?? null,
    evidence: entry.evidence ?? [],
    provenance: entry.provenance ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    note: entry.note ?? null,
  };
}

/**
 * Writes one or more audit entries. Never throws — a failed audit write must
 * never fail a pipeline call (erd.md §9.3's availability-over-completeness
 * tradeoff); errors are logged and swallowed instead.
 */
export async function recordAudit(supabase: AuditSupabaseLike, entries: AuditEntryDraft | AuditEntryDraft[]): Promise<void> {
  const list = Array.isArray(entries) ? entries : [entries];
  if (list.length === 0) return;
  try {
    await ensureRun(supabase, list[0]!.runId, list[0]!.userId);
    const { error } = await supabase.from('run_audit').insert(list.map(toRow));
    if (error) console.error('[winback] audit: failed to write entries', error.message);
  } catch (err) {
    console.error('[winback] audit: unexpected failure', err);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/audit/record.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/audit/record.ts src/lib/audit/record.test.ts
git commit -m "feat(audit): add recordAudit — the sole write path to run_audit"
```

---

## Task 5: Wire `recordAudit` into `/api/extract`

**Files:**
- Modify: `src/app/api/extract/route.ts`

**Interfaces:**
- Consumes: `recordAudit`, `AuditEntryDraft` from `@/lib/audit/record`; `createServerSupabaseClient` from `@/lib/supabase/server`; `userId` param from Task 3.

- [ ] **Step 1: Wire it in**

Replace the full route body with:

```ts
// ============================================================================
// POST /api/extract — erd.md Part 2 §5.2, Part 5 §5.4
// ============================================================================

import { TARGET_DOCS } from '@/data/target';
import { ExtractRequestSchema, ExtractResponseSchema } from '@/lib/contracts/schemas';
import type { ApiMeta } from '@/lib/contracts/types';
import { apiError, apiSuccess, parseBody, validateOwnOutput, withRoute } from '@/lib/pipeline/http';
import { runExtraction } from '@/lib/pipeline/extraction';
import { recordAudit } from '@/lib/audit/record';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  return withRoute(req, 'POST /api/extract', 'llm', async (userId) => {
    const started = Date.now();
    const parsed = await parseBody(req, ExtractRequestSchema);
    if (!parsed.ok) return parsed.response;

    const { runId, docIds } = parsed.data;
    const supabase = await createServerSupabaseClient();
    await recordAudit(supabase, { runId, userId, actor: 'system', action: 'stage_started', stage: 'extract' });

    const docs = docIds.map((id) => TARGET_DOCS.find((d) => d.id === id));
    const unknownIndex = docs.findIndex((d) => !d);
    if (unknownIndex !== -1) {
      return apiError('BAD_REQUEST', `Unknown docId: ${docIds[unknownIndex]}`);
    }

    let result;
    try {
      result = await runExtraction(
        docs.filter((d): d is NonNullable<typeof d> => Boolean(d)),
        TARGET_DOCS,
      );
    } catch (err) {
      await recordAudit(supabase, {
        runId, userId, actor: 'system', action: 'stage_failed', stage: 'extract',
        note: err instanceof Error ? err.message : String(err),
      });
      return apiError('LLM_ERROR', 'Extraction failed for every document', {
        message: err instanceof Error ? err.message : String(err),
      });
    }

    const violation = validateOwnOutput(ExtractResponseSchema, {
      ok: true,
      data: result,
      meta: { ms: 0, model: result.profile.provenance.producedBy, mock: false },
    });
    if (violation) return violation;

    await recordAudit(supabase, [
      { runId, userId, actor: 'system', action: 'stage_completed', stage: 'extract' },
      {
        runId, userId, actor: result.profile.provenance.actor, action: 'statement_generated', stage: 'extract',
        statementId: result.profile.statementId, statementText: result.profile.businessSummary,
        provenance: result.profile.provenance,
      },
      ...result.failures.map((failure) => ({
        runId, userId, actor: 'system' as const, action: 'stage_failed' as const, stage: 'extract' as const,
        note: `${failure.docId ? `${failure.docId}: ` : ''}${failure.code} — ${failure.message}`,
      })),
      ...(result.droppedEvidenceRefs > 0
        ? [{
            runId, userId, actor: 'system' as const, action: 'evidence_dropped' as const, stage: 'extract' as const,
            note: `${result.droppedEvidenceRefs} evidence ref(s) dropped during extraction`,
          }]
        : []),
    ]);

    const meta: ApiMeta = {
      ms: Date.now() - started,
      model: result.profile.provenance.producedBy,
      mock: result.profile.provenance.producedBy === 'mock',
      droppedEvidenceRefs: result.droppedEvidenceRefs,
    };
    return apiSuccess(result, meta);
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no new errors from this file (`ExtractRequestSchema` now includes `runId` per Task 2, satisfied here).

- [ ] **Step 3: Run the pipeline test suite**

Run: `npx vitest run src/lib/__tests__/evidence.test.ts`
Expected: PASS (unaffected — this task doesn't touch extraction logic, only the route wrapper).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/extract/route.ts
git commit -m "feat(audit): record stage lifecycle and statement provenance for /api/extract"
```

---

## Task 6: Wire `recordAudit` into `/api/benchmark` and `/api/portfolio`

**Files:**
- Modify: `src/app/api/benchmark/route.ts`
- Modify: `src/app/api/portfolio/route.ts`

**Interfaces:**
- Consumes: same as Task 5.

- [ ] **Step 1: `/api/benchmark`**

Add the imports (`recordAudit`, `createServerSupabaseClient`), change the handler to `async (userId) => {`, destructure `const { runId, profile } = parsed.data;`, and add:

```ts
    const supabase = await createServerSupabaseClient();
    await recordAudit(supabase, { runId, userId, actor: 'system', action: 'stage_started', stage: 'benchmark' });
```

right after the `parsed.data` destructure, and immediately before `return apiSuccess(data, meta);` add:

```ts
    await recordAudit(supabase, [
      { runId, userId, actor: 'system', action: 'stage_completed', stage: 'benchmark' },
      {
        runId, userId, actor: data.provenance.actor, action: 'statement_generated', stage: 'benchmark',
        statementId: data.statementId, statementText: data.commentary ?? `Benchmark computed for ${profile.name} (no commentary — degraded)`,
        provenance: data.provenance,
      },
    ]);
```

- [ ] **Step 2: `/api/portfolio`**

Same shape. First read the current file in full (it's 113 lines — longer than benchmark's, includes its own commentary-generation try/catch) before editing, so the destructure and insertion points match exactly. Add:

```ts
    const supabase = await createServerSupabaseClient();
    await recordAudit(supabase, { runId, userId, actor: 'system', action: 'stage_started', stage: 'portfolio' });
```
right after destructuring `{ runId, profile, dealSizeUsdM }` from `parsed.data`, and before the final `return apiSuccess(data, meta);`:

```ts
    await recordAudit(supabase, [
      { runId, userId, actor: 'system', action: 'stage_completed', stage: 'portfolio' },
      {
        runId, userId, actor: data.provenance.actor, action: 'statement_generated', stage: 'portfolio',
        statementId: data.statementId, statementText: data.headline ?? 'Portfolio impact computed (no headline — degraded)',
        provenance: data.provenance,
      },
    ]);
```

- [ ] **Step 3: Typecheck and test**

Run: `npm run typecheck && npx vitest run src/lib/__tests__/benchmark.test.ts src/lib/__tests__/portfolio.test.ts`
Expected: typecheck clean on these two files; both unit test files pass unchanged (they test the pure `computeBenchmarkRows`/`computeConcentration` functions, not the routes).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/benchmark/route.ts src/app/api/portfolio/route.ts
git commit -m "feat(audit): record stage lifecycle and statement provenance for benchmark and portfolio"
```

---

## Task 7: Wire `recordAudit` into `/api/crosscheck`

**Files:**
- Modify: `src/app/api/crosscheck/route.ts`

**Interfaces:**
- Consumes: same as Task 5. Produces two `statement_generated` entries (one per `DecisionResult.crosschecks[]` item — always exactly 2, per `CrosscheckIdSchema`'s two-member enum).

- [ ] **Step 1: Wire it in**

```ts
// ============================================================================
// POST /api/crosscheck — erd.md Part 2 §5.5, Part 5 §5.7
// ============================================================================

import { TARGET_DOCS } from '@/data/target';
import { CrosscheckRequestSchema, CrosscheckResponseSchema } from '@/lib/contracts/schemas';
import type { ApiMeta } from '@/lib/contracts/types';
import { apiError, apiSuccess, parseBody, validateOwnOutput, withRoute } from '@/lib/pipeline/http';
import { runDecision } from '@/lib/pipeline/decision';
import { recordAudit } from '@/lib/audit/record';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  return withRoute(req, 'POST /api/crosscheck', 'llm', async (userId) => {
    const started = Date.now();
    const parsed = await parseBody(req, CrosscheckRequestSchema);
    if (!parsed.ok) return parsed.response;

    const { runId, docIds, profile } = parsed.data;
    const supabase = await createServerSupabaseClient();
    await recordAudit(supabase, { runId, userId, actor: 'system', action: 'stage_started', stage: 'decision' });

    const unknownId = docIds.find((id) => !TARGET_DOCS.some((d) => d.id === id));
    if (unknownId) return apiError('BAD_REQUEST', `Unknown docId: ${unknownId}`);

    let result;
    try {
      result = await runDecision(docIds, profile, TARGET_DOCS);
    } catch (err) {
      await recordAudit(supabase, {
        runId, userId, actor: 'system', action: 'stage_failed', stage: 'decision',
        note: err instanceof Error ? err.message : String(err),
      });
      return apiError('LLM_ERROR', 'Crosscheck failed for every definition', {
        message: err instanceof Error ? err.message : String(err),
      });
    }

    const model = result.crosschecks[0]?.provenance.producedBy ?? 'none';
    const violation = validateOwnOutput(CrosscheckResponseSchema, {
      ok: true,
      data: result,
      meta: { ms: 0, model, mock: false },
    });
    if (violation) return violation;

    await recordAudit(supabase, [
      { runId, userId, actor: 'system', action: 'stage_completed', stage: 'decision' },
      ...result.crosschecks.map((c) => ({
        runId, userId, actor: c.provenance.actor, action: 'statement_generated' as const, stage: 'decision' as const,
        statementId: c.statementId, statementText: c.explanation,
        evidence: [...c.claim.evidence, ...c.counterEvidence],
        provenance: c.provenance,
      })),
      ...result.failures.map((failure) => ({
        runId, userId, actor: 'system' as const, action: 'stage_failed' as const, stage: 'decision' as const,
        note: `${failure.docId ? `${failure.docId}: ` : ''}${failure.code} — ${failure.message}`,
      })),
    ]);

    const meta: ApiMeta = { ms: Date.now() - started, model, mock: model === 'mock' };
    return apiSuccess(result, meta);
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean for this file.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/crosscheck/route.ts
git commit -m "feat(audit): record stage lifecycle and per-crosscheck provenance for /api/crosscheck"
```

---

## Task 8: Wire `recordAudit` into `/api/memo`

**Files:**
- Modify: `src/app/api/memo/route.ts`

**Interfaces:**
- Consumes: same as Task 5. Produces up to 5 `statement_generated` entries — one per `IcMemo.sections[]` (per `MemoSectionIdSchema`'s five-member enum).

- [ ] **Step 1: Wire it in**

```ts
import { MemoRequestSchema, MemoResponseSchema } from '@/lib/contracts/schemas';
import type { ApiMeta } from '@/lib/contracts/types';
import { apiError, apiSuccess, parseBody, validateOwnOutput, withRoute } from '@/lib/pipeline/http';
import { runMemo } from '@/lib/pipeline/memo';
import { recordAudit } from '@/lib/audit/record';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  return withRoute(req, 'POST /api/memo', 'llm', async (userId) => {
    const started = Date.now();
    const parsed = await parseBody(req, MemoRequestSchema);
    if (!parsed.ok) return parsed.response;

    const { runId, deal, profile, benchmark, portfolio, crosschecks } = parsed.data;
    const supabase = await createServerSupabaseClient();
    await recordAudit(supabase, { runId, userId, actor: 'system', action: 'stage_started', stage: 'memo' });

    let result;
    try {
      result = await runMemo(deal, profile, benchmark, portfolio, crosschecks);
    } catch (err) {
      await recordAudit(supabase, {
        runId, userId, actor: 'system', action: 'stage_failed', stage: 'memo',
        note: err instanceof Error ? err.message : String(err),
      });
      return apiError('LLM_ERROR', 'Memo generation failed', {
        message: err instanceof Error ? err.message : String(err),
      });
    }

    const model = result.sections[0]?.provenance.producedBy ?? 'none';
    const violation = validateOwnOutput(MemoResponseSchema, {
      ok: true,
      data: result,
      meta: { ms: 0, model, mock: false },
    });
    if (violation) return violation;

    await recordAudit(supabase, [
      { runId, userId, actor: 'system', action: 'stage_completed', stage: 'memo' },
      ...result.sections.map((s) => ({
        runId, userId, actor: s.provenance.actor, action: 'statement_generated' as const, stage: 'memo' as const,
        statementId: s.statementId, statementText: s.body, evidence: s.evidence, provenance: s.provenance,
      })),
    ]);

    const meta: ApiMeta = { ms: Date.now() - started, model, mock: model === 'mock' };
    return apiSuccess(result, meta);
  });
}
```

- [ ] **Step 2: Typecheck and full test run**

Run: `npm run typecheck && npm test`
Expected: typecheck clean everywhere now (Task 2's `runId` gap is fully closed — every one of the five request schemas' consumers has been updated); `npm test` passes in full.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/memo/route.ts
git commit -m "feat(audit): record stage lifecycle and per-section provenance for /api/memo"
```

---

## Task 9: `POST /api/audit/event` — client-triggered events

**Files:**
- Create: `src/app/api/audit/event/route.ts`

**Interfaces:**
- Consumes: `AuditEventRequestSchema`/`AuditEventResponseSchema` (Task 2), `recordAudit` (Task 4).
- Produces: the endpoint later tasks' client code (`recordAuditEvent` in Task 11) calls.

- [ ] **Step 1: Write the route**

```ts
// ============================================================================
// POST /api/audit/event — erd.md Part 9.1 Guarantee 2 (client-originated half)
//
// The only audit actions a client is trusted to self-report: analyst
// accept/dismiss/edit, memo status changes, and "viewed a previously-run
// deal". Stage lifecycle and statement_generated are always server-computed
// (see the five pipeline routes) — a client can never fabricate those here,
// because AuditEventRequestSchema's `action` is restricted to
// AuditClientActionSchema, a strict subset of AuditActionSchema.
// ============================================================================

import { AuditEventRequestSchema } from '@/lib/contracts/schemas';
import type { ApiMeta } from '@/lib/contracts/types';
import { apiSuccess, parseBody, withRoute } from '@/lib/pipeline/http';
import { recordAudit } from '@/lib/audit/record';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function POST(req: Request) {
  return withRoute(req, 'POST /api/audit/event', 'standard', async (userId) => {
    const started = Date.now();
    const parsed = await parseBody(req, AuditEventRequestSchema);
    if (!parsed.ok) return parsed.response;

    const { runId, action, stage, statementId, statementText, before, after, note } = parsed.data;
    const supabase = await createServerSupabaseClient();
    await recordAudit(supabase, {
      runId,
      userId,
      actor: 'analyst',
      action,
      stage,
      statementId,
      statementText,
      before,
      after,
      note,
    });

    const meta: ApiMeta = { ms: Date.now() - started, model: 'none', mock: false };
    return apiSuccess({ recorded: true as const }, meta);
  });
}
```

Note `session_viewed` is reported with `actor: 'analyst'` even though it isn't an editorial action — that's fine, `Actor` only distinguishes who/what performed the action, and a client-side page view is unambiguously the analyst, not the system or the model.

- [ ] **Step 2: Write a route-level test**

```ts
// src/app/api/audit/event/route.test.ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/session', () => ({ getUserId: vi.fn(async () => 'user-1') }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(async () => ({ from: () => ({
  upsert: async () => ({ error: null }),
  insert: async () => ({ error: null }),
}) })) }));

import { POST } from './route';

function request(body: unknown): Request {
  return new Request('http://localhost/api/audit/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/audit/event', () => {
  it('accepts a valid client action', async () => {
    const res = await POST(request({ runId: 'run-1', action: 'session_viewed' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, data: { recorded: true } });
  });

  it('rejects a server-only action', async () => {
    const res = await POST(request({ runId: 'run-1', action: 'stage_completed' }));
    expect(res.status).toBe(400);
  });

  it('rejects a missing runId', async () => {
    const res = await POST(request({ action: 'session_viewed' }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3: Run it**

Run: `npx vitest run src/app/api/audit/event/route.test.ts`
Expected: PASS (3 tests) — the second test proves the security boundary: `stage_completed` isn't in `AuditClientActionSchema`, so Zod rejects it with `BAD_REQUEST` before `recordAudit` is ever called.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/audit/event/route.ts src/app/api/audit/event/route.test.ts
git commit -m "feat(audit): add POST /api/audit/event for client-triggered actions"
```

---

## Task 10: Thread `runId` through the client pipeline + `recordAuditEvent` helper

**Files:**
- Modify: `src/lib/client/api.ts`
- Modify: `src/app/deal/[id]/ingest/page.tsx:45`, `src/app/deal/[id]/analysis/page.tsx:52,57`, `src/app/deal/[id]/decision/page.tsx:27,32` (call sites only — these still live at their pre-Task-13 paths right now)

**Interfaces:**
- Consumes: `AuditEventRequestSchema`, `AuditEventResponseSchema`, `AuditClientAction` (Task 2).
- Produces: `recordAuditEvent(input: { runId: string; action: AuditClientAction; stage?: Stage | null; statementId?: string | null; statementText?: string | null; before?: string | null; after?: string | null; note?: string | null }): void` — Tasks 11 and 12 call this exact function.

- [ ] **Step 1: Add `runId` parameters and `recordAuditEvent`**

In `src/lib/client/api.ts`, add to the imports:

```ts
import { AuditEventResponseSchema } from '@/lib/contracts/schemas';
import type { AuditClientAction, Stage } from '@/lib/contracts/types';
```

Change each `run*` function's signature and its `postJson` body to include `runId` first:

```ts
export async function runExtract(dispatch: Dispatch, runId: string, docIds: SourceDocId[]): Promise<ExtractionResult | null> {
  dispatch({ type: 'STAGE_START', stage: 'extract' });
  try {
    const json = await postJson('/api/extract', { runId, docIds });
    // ...unchanged from here
```

```ts
export async function runBenchmark(dispatch: Dispatch, runId: string, profile: CompanyProfile): Promise<BenchmarkResult | null> {
  dispatch({ type: 'STAGE_START', stage: 'benchmark' });
  try {
    const json = await postJson('/api/benchmark', { runId, profile });
    // ...unchanged
```

```ts
export async function runPortfolio(
  dispatch: Dispatch,
  runId: string,
  profile: CompanyProfile,
  dealSizeUsdM: number,
): Promise<PortfolioImpact | null> {
  dispatch({ type: 'STAGE_START', stage: 'portfolio' });
  try {
    const json = await postJson('/api/portfolio', { runId, profile, dealSizeUsdM });
    // ...unchanged
```

```ts
export async function runCrosscheck(
  dispatch: Dispatch,
  runId: string,
  docIds: SourceDocId[],
  profile: CompanyProfile,
): Promise<DecisionResult | null> {
  dispatch({ type: 'STAGE_START', stage: 'decision' });
  try {
    const json = await postJson('/api/crosscheck', { runId, docIds, profile });
    // ...unchanged
```

```ts
export async function runMemo(
  dispatch: Dispatch,
  runId: string,
  deal: Deal,
  profile: CompanyProfile,
  benchmark: BenchmarkResult,
  portfolio: PortfolioImpact,
  crosschecks: Crosscheck[],
): Promise<IcMemo | null> {
  dispatch({ type: 'STAGE_START', stage: 'memo' });
  try {
    const json = await postJson('/api/memo', { runId, deal, profile, benchmark, portfolio, crosschecks });
    // ...unchanged
```

Then append, at the end of the file:

```ts
/**
 * Fire-and-forget from the caller's perspective — never awaited, never
 * throws into the UI. Records an analyst action or a "viewed an old run"
 * event (erd.md Part 9.1 Guarantee 2's client-originated half).
 */
export function recordAuditEvent(input: {
  runId: string;
  action: AuditClientAction;
  stage?: Stage | null;
  statementId?: string | null;
  statementText?: string | null;
  before?: string | null;
  after?: string | null;
  note?: string | null;
}): void {
  void (async () => {
    try {
      const json = await postJson('/api/audit/event', input);
      AuditEventResponseSchema.safeParse(json); // best-effort only — nothing depends on the shape here
    } catch {
      // Never surfaced to the UI — see file header on runExtract et al. for why
      // this pattern is safe: it's advisory, not part of the pipeline contract.
    }
  })();
}
```

- [ ] **Step 2: Update the three call sites**

`src/app/deal/[id]/ingest/page.tsx:45`:
```ts
    void runExtract(dispatch, run.id, docIds);
```

`src/app/deal/[id]/analysis/page.tsx:52,57`:
```ts
    void runBenchmark(dispatch, run.id, profile);
```
```ts
    void runPortfolio(dispatch, run.id, profile, dealSizeUsdM);
```

`src/app/deal/[id]/decision/page.tsx` — read the file first to confirm the exact current call sites (line numbers may drift after Task 2/3 edits elsewhere), then:
```ts
    void runCrosscheck(dispatch, run.id, docIds, run.extraction.profile);
```
and the `runMemo(...)` call gains `run.id` as its second argument, matching the new signature above.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/client/api.ts src/app/deal/[id]/ingest/page.tsx src/app/deal/[id]/analysis/page.tsx src/app/deal/[id]/decision/page.tsx
git commit -m "feat(audit): thread runId through the client pipeline and add recordAuditEvent"
```

---

## Task 11: Wire analyst actions — `crosscheck-card.tsx` and `memo-card.tsx`

**Files:**
- Modify: `src/components/decision/crosscheck-card.tsx`
- Modify: `src/components/decision/memo-card.tsx`

**Interfaces:**
- Consumes: `recordAuditEvent` (Task 10), `useRun` (existing) for `run.id`.

- [ ] **Step 1: `crosscheck-card.tsx`**

Add the import: `import { recordAuditEvent } from '@/lib/client/api';`

Change `const { dispatch } = useRun();` to `const { run, dispatch } = useRun();`, then:

```ts
  function setDecision(decision: 'accepted' | 'dismissed') {
    dispatch({ type: 'CROSSCHECK_DECISION', crosscheckId: crosscheck.id, decision });
    recordAuditEvent({
      runId: run.id,
      action: decision === 'accepted' ? 'analyst_accepted' : 'analyst_dismissed',
      stage: 'decision',
      statementId: crosscheck.statementId,
      statementText: crosscheck.explanation,
    });
  }

  function saveEdit() {
    dispatch({ type: 'CROSSCHECK_DECISION', crosscheckId: crosscheck.id, decision: 'accepted', note: draft });
    recordAuditEvent({
      runId: run.id,
      action: 'analyst_edited',
      stage: 'decision',
      statementId: crosscheck.statementId,
      before: crosscheck.analystNote ?? crosscheck.suggestedMemoLanguage,
      after: draft,
    });
    setEditing(false);
  }
```

- [ ] **Step 2: `memo-card.tsx`**

Add the import: `import { recordAuditEvent } from '@/lib/client/api';`

`const { run, dispatch } = useRun();` (already destructures `run` — confirm before editing; if it already does, skip this rename), then:

```ts
  function editSection(id: string, body: string) {
    const section = memo?.sections.find((s) => s.id === id);
    dispatch({ type: 'MEMO_EDIT_SECTION', sectionId: id, body });
    if (section) {
      recordAuditEvent({
        runId: run.id,
        action: 'analyst_edited',
        stage: 'memo',
        statementId: section.statementId,
        before: section.body,
        after: body,
      });
    }
  }

  function setStatus(status: 'draft' | 'analyst_edited' | 'approved') {
    dispatch({ type: 'MEMO_STATUS', status });
    recordAuditEvent({ runId: run.id, action: 'memo_status_changed', stage: 'memo', note: `Memo marked ${status}` });
    toast.success(`Memo marked as ${status.replace('_', ' ')}`);
  }
```

(`editSection` needs `memo` in scope, already true — it's `run.memo`, bound to the local `memo` const near the top of `MemoCard`.)

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/decision/crosscheck-card.tsx src/components/decision/memo-card.tsx
git commit -m "feat(audit): record analyst accept/dismiss/edit and memo status changes"
```

---

## Task 12: `session_viewed` on rehydrate + restructure `/deal/[id]/*` into a `(pipeline)` group

**Files:**
- Modify: `src/components/app-shell/deal-gate.tsx`
- Move: `src/app/deal/[id]/layout.tsx` → `src/app/deal/[id]/(pipeline)/layout.tsx`
- Move: `src/app/deal/[id]/ingest/` → `src/app/deal/[id]/(pipeline)/ingest/`
- Move: `src/app/deal/[id]/analysis/` → `src/app/deal/[id]/(pipeline)/analysis/`
- Move: `src/app/deal/[id]/decision/` → `src/app/deal/[id]/(pipeline)/decision/`

**Interfaces:**
- Consumes: `recordAuditEvent` (Task 10).
- Produces: `/deal/[id]/ingest`, `/deal/[id]/analysis`, `/deal/[id]/decision` keep their exact URLs (Next.js route groups `(name)` don't appear in the path) — Task 13's `/deal/[id]/audit` page can now live as a *sibling* of `(pipeline)`, not a child, so it is never wrapped by `DealGate`.

- [ ] **Step 1: Move the three route folders and the layout**

```bash
cd /Users/rochakagarwal/orca/projects/Winback/winback
mkdir -p "src/app/deal/[id]/(pipeline)"
git mv "src/app/deal/[id]/ingest" "src/app/deal/[id]/(pipeline)/ingest"
git mv "src/app/deal/[id]/analysis" "src/app/deal/[id]/(pipeline)/analysis"
git mv "src/app/deal/[id]/decision" "src/app/deal/[id]/(pipeline)/decision"
git mv "src/app/deal/[id]/layout.tsx" "src/app/deal/[id]/(pipeline)/layout.tsx"
```

- [ ] **Step 2: Fix the moved layout's `params` shape if needed**

Read `src/app/deal/[id]/(pipeline)/layout.tsx` after the move — it should be unchanged (`params: Promise<{ id: string }>` still resolves correctly since the dynamic segment `[id]` is still the parent directory; the route group adds no path segment). No edit expected, but verify by running `npm run build` in Step 5 below.

- [ ] **Step 3: Add `session_viewed` to `DealGate`**

```ts
// src/components/app-shell/deal-gate.tsx
'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { loadRunFromStorage, useRun } from '@/lib/store/RunProvider';
import { recordAuditEvent } from '@/lib/client/api';

export function DealGate({ id, children }: { id: string; children: ReactNode }) {
  const { run, dispatch } = useRun();
  const router = useRouter();
  const isCurrent = run.id === id;

  useEffect(() => {
    if (run.id === id) return;
    const stored = loadRunFromStorage(id);
    if (stored) {
      dispatch({ type: 'HYDRATE', run: stored });
      recordAuditEvent({ runId: id, action: 'session_viewed', note: 'Reopened from a previous browser session' });
    } else {
      router.replace('/');
    }
    // `dispatch`/`router` are stable — only re-check when the route id or the loaded run actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, run.id]);

  if (!isCurrent) return null;
  return <>{children}</>;
}
```

- [ ] **Step 4: Update the Sidebar's hrefs if they hardcode the old segment structure**

Read `src/components/app-shell/sidebar.tsx` — its `items` array builds hrefs as `` `/deal/${run.id}/ingest` `` etc., which are unaffected by the route group move (URLs are unchanged). No edit needed here; this step is just a check, not a code change.

- [ ] **Step 5: Build and verify routing**

Run: `npm run build`
Expected: build succeeds; the route manifest shows `/deal/[id]/ingest`, `/deal/[id]/analysis`, `/deal/[id]/decision` at their original URLs (grep the build output or `.next/` route manifest for `(pipeline)` — it should not appear in any URL).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(deal): move pipeline screens into a (pipeline) route group so /audit can bypass DealGate"
```

---

## Task 13: `src/lib/audit/read.ts` — DI-testable list/export handlers

**Files:**
- Create: `src/lib/audit/read.ts`
- Test: `src/lib/audit/read.test.ts`

**Interfaces:**
- Consumes: `AuditEntry`, `AuditAction` types.
- Produces: `AuditSource` interface, `createAuditListHandler(source: AuditSource)`, `createAuditExportHandler(source: AuditSource)` — Task 14 wires real Supabase into both.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/audit/read.test.ts
import { describe, expect, it, vi } from 'vitest';
import type { AuditEntry } from '@/lib/contracts/types';
import { createAuditListHandler, createAuditExportHandler, type AuditSource } from './read';

function entry(id: string, overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id, sessionId: 'run-1', userId: 'alice', at: '2026-09-05T00:00:00.000Z', actor: 'system',
    action: 'stage_started', stage: 'extract', statementId: null, statementText: null,
    evidence: [], provenance: null, before: null, after: null, note: null,
    ...overrides,
  };
}

function fixture() {
  let userId: string | null = 'alice';
  const runs = new Map([['run-1', { id: 'run-1', userId: 'alice' }]]);
  const entries = [entry('c1'), entry('c0')];
  const source: AuditSource = {
    getUserId: async () => userId,
    getRun: async (id) => runs.get(id) ?? null,
    listAuditEntries: vi.fn(async () => entries),
  };
  return { source, setUser: (id: string | null) => { userId = id; } };
}

describe('createAuditListHandler', () => {
  it('requires sign-in', async () => {
    const { source, setUser } = fixture();
    setUser(null);
    const res = await createAuditListHandler(source)(new Request('http://localhost/x'), 'run-1');
    expect(res.status).toBe(401);
  });

  it('returns the same 404 for a foreign run and a missing run', async () => {
    const { source } = fixture();
    const handler = createAuditListHandler(source);
    const foreign = await handler(new Request('http://localhost/x'), 'run-1');
    // simulate a foreign run by asking for one not in the map
    const missing = await handler(new Request('http://localhost/x'), 'nope');
    expect(missing.status).toBe(404);
    // foreign-run case covered by getRun returning a row whose userId doesn't match — exercised via a second fixture:
    const source2: AuditSource = { ...source, getRun: async () => ({ id: 'run-1', userId: 'bob' }) };
    const foreign2 = await createAuditListHandler(source2)(new Request('http://localhost/x'), 'run-1');
    expect(foreign2.status).toBe(404);
    expect(await foreign2.json()).toEqual(await missing.json());
    void foreign;
  });

  it('lists entries newest-first with a nextCursor', async () => {
    const { source } = fixture();
    const res = await createAuditListHandler(source)(new Request('http://localhost/x?limit=1'), 'run-1');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.entries).toHaveLength(1);
  });
});

describe('createAuditExportHandler', () => {
  it('sets a Content-Disposition attachment header', async () => {
    const { source } = fixture();
    const res = await createAuditExportHandler(source)(new Request('http://localhost/x'), 'run-1');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment; filename="run-1-audit\.json"$/);
    const body = await res.json();
    expect(body.entries).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/audit/read.test.ts`
Expected: FAIL — `Cannot find module './read'`.

- [ ] **Step 3: Implement**

```ts
// src/lib/audit/read.ts
//
// Handler-factory pattern mirrors src/lib/graph/http.ts's createGraphHandler:
// business logic against an injected `AuditSource`, so both handlers are
// fully unit-testable without a live database. The two real route files
// (Task 14) wire a Supabase-backed AuditSource in.

import { NextResponse } from 'next/server';
import type { AuditAction, AuditEntry } from '@/lib/contracts/types';

export interface RunRow {
  id: string;
  userId: string;
}

export interface AuditListOptions {
  limit: number;
  cursor: string | null;
  action: AuditAction | null;
}

export interface AuditSource {
  getUserId(): Promise<string | null>;
  getRun(id: string): Promise<RunRow | null>;
  listAuditEntries(runId: string, opts: AuditListOptions): Promise<AuditEntry[]>;
}

const NOT_FOUND = NextResponse.json(
  { ok: false, error: { code: 'NOT_FOUND', message: 'Run not found' } },
  { status: 404 },
);

/** Shared ownership check — same 404-for-foreign-and-missing rule as the graph route. */
async function loadOwnedRun(source: AuditSource, runId: string): Promise<{ userId: string } | NextResponse> {
  const userId = await source.getUserId();
  if (!userId) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, { status: 401 });
  const run = await source.getRun(runId);
  if (!run || run.userId !== userId) return NOT_FOUND;
  return { userId };
}

const VALID_ACTIONS: readonly AuditAction[] = [
  'stage_started', 'stage_completed', 'stage_failed', 'statement_generated', 'evidence_dropped',
  'analyst_accepted', 'analyst_dismissed', 'analyst_edited', 'memo_status_changed',
  'session_created', 'session_viewed', 'session_deleted',
];

export function createAuditListHandler(source: AuditSource) {
  return async function handler(req: Request, runId: string): Promise<NextResponse> {
    const owned = await loadOwnedRun(source, runId);
    if (owned instanceof NextResponse) return owned;

    const url = new URL(req.url);
    const limitParam = Number(url.searchParams.get('limit') ?? '100');
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 100;
    const cursor = url.searchParams.get('cursor');
    const actionParam = url.searchParams.get('action');
    if (actionParam && !VALID_ACTIONS.includes(actionParam as AuditAction)) {
      return NextResponse.json({ ok: false, error: { code: 'BAD_REQUEST', message: `Unknown action: ${actionParam}` } }, { status: 400 });
    }

    const entries = await source.listAuditEntries(runId, { limit, cursor, action: (actionParam as AuditAction) ?? null });
    const nextCursor = entries.length === limit ? (entries.at(-1)?.id ?? null) : null;

    return NextResponse.json({
      ok: true,
      data: { entries, nextCursor },
      meta: { ms: 0, model: 'none', mock: false },
    });
  };
}

export function createAuditExportHandler(source: AuditSource) {
  return async function handler(req: Request, runId: string): Promise<NextResponse> {
    const owned = await loadOwnedRun(source, runId);
    if (owned instanceof NextResponse) return owned;
    void req;

    const entries = await source.listAuditEntries(runId, { limit: 10_000, cursor: null, action: null });
    return NextResponse.json(
      { runId, exportedAt: new Date().toISOString(), entries },
      { headers: { 'Content-Disposition': `attachment; filename="${runId}-audit.json"` } },
    );
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/audit/read.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/audit/read.ts src/lib/audit/read.test.ts
git commit -m "feat(audit): add DI-testable list/export handlers"
```

---

## Task 14: Wire real Supabase into the audit read routes

**Files:**
- Create: `src/app/api/runs/[id]/audit/route.ts`
- Create: `src/app/api/runs/[id]/audit/export/route.ts`

**Interfaces:**
- Consumes: `createAuditListHandler`, `createAuditExportHandler`, `AuditSource` (Task 13); `getUserId` (existing); `createServerSupabaseClient` (existing).

- [ ] **Step 1: `GET /api/runs/[id]/audit`**

```ts
// ============================================================================
// GET /api/runs/[id]/audit — erd.md Part 9.5, adapted to Postgres/Supabase
//
// Ownership-checked (404-not-403, same rule as GET /api/graph), paginated,
// newest first, optional ?action= filter.
// ============================================================================

import type { AuditEntry } from '@/lib/contracts/types';
import { createAuditListHandler, type AuditSource } from '@/lib/audit/read';
import { getUserId } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function toEntry(row: Record<string, unknown>): AuditEntry {
  return {
    id: row.id as string,
    sessionId: row.run_id as string,
    userId: row.user_id as string,
    at: row.at as string,
    actor: row.actor as AuditEntry['actor'],
    action: row.action as AuditEntry['action'],
    stage: (row.stage as AuditEntry['stage']) ?? null,
    statementId: (row.statement_id as string | null) ?? null,
    statementText: (row.statement_text as string | null) ?? null,
    evidence: (row.evidence as AuditEntry['evidence']) ?? [],
    provenance: (row.provenance as AuditEntry['provenance']) ?? null,
    before: (row.before as string | null) ?? null,
    after: (row.after as string | null) ?? null,
    note: (row.note as string | null) ?? null,
  };
}

async function buildSource(): Promise<AuditSource> {
  const supabase = await createServerSupabaseClient();
  return {
    getUserId,
    getRun: async (id) => {
      const { data } = await supabase.from('runs').select('id, user_id').eq('id', id).maybeSingle();
      return data ? { id: data.id, userId: data.user_id } : null;
    },
    listAuditEntries: async (runId, { limit, cursor, action }) => {
      let query = supabase.from('run_audit').select('*').eq('run_id', runId).order('id', { ascending: false }).limit(limit);
      if (cursor) query = query.lt('id', cursor);
      if (action) query = query.eq('action', action);
      const { data } = await query;
      return (data ?? []).map(toEntry);
    },
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const source = await buildSource();
  return createAuditListHandler(source)(req, id);
}
```

- [ ] **Step 2: `GET /api/runs/[id]/audit/export`**

```ts
// ============================================================================
// GET /api/runs/[id]/audit/export — erd.md Part 9.5
// ============================================================================

import { createAuditExportHandler } from '@/lib/audit/read';
import { buildAuditSource } from '@/lib/audit/supabase-source';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const source = await buildAuditSource();
  return createAuditExportHandler(source)(req, id);
}
```

Wait — this references `@/lib/audit/supabase-source`, which doesn't exist yet. Rather than duplicate `buildSource` in two files, extract it now.

- [ ] **Step 2a: Extract the shared source builder**

Create `src/lib/audit/supabase-source.ts` with the `toEntry` and `buildSource` (renamed `buildAuditSource`) functions exactly as written in Step 1 above, then simplify `src/app/api/runs/[id]/audit/route.ts` to:

```ts
import { createAuditListHandler } from '@/lib/audit/read';
import { buildAuditSource } from '@/lib/audit/supabase-source';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const source = await buildAuditSource();
  return createAuditListHandler(source)(req, id);
}
```

and `src/app/api/runs/[id]/audit/export/route.ts` stays as written in Step 2.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/audit/supabase-source.ts src/app/api/runs/[id]/audit/route.ts src/app/api/runs/[id]/audit/export/route.ts
git commit -m "feat(audit): wire Supabase-backed audit list and export routes"
```

---

## Task 15: Labels + `<Popover>` primitive

**Files:**
- Modify: `src/lib/labels.ts`
- Create: `src/components/ui/popover.tsx`

**Interfaces:**
- Produces: `AUDIT_ACTION_LABEL`, `ACTOR_LABEL` (Record<string,string>, consumed by Task 16); `Popover`, `PopoverTrigger`, `PopoverContent` (consumed by Task 17).

- [ ] **Step 1: Add labels**

Append to `src/lib/labels.ts`:

```ts
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  stage_started: 'Stage started',
  stage_completed: 'Stage completed',
  stage_failed: 'Stage failed',
  statement_generated: 'Statement generated',
  evidence_dropped: 'Evidence dropped',
  analyst_accepted: 'Accepted by analyst',
  analyst_dismissed: 'Dismissed by analyst',
  analyst_edited: 'Edited by analyst',
  memo_status_changed: 'Memo status changed',
  session_created: 'Deal created',
  session_viewed: 'Deal viewed',
  session_deleted: 'Deal deleted',
};

export const ACTOR_LABEL: Record<string, string> = {
  system: 'System',
  model: 'Model',
  analyst: 'Analyst',
};
```

- [ ] **Step 2: Add the popover primitive**

```tsx
// src/components/ui/popover.tsx — click-to-open, mirrors tooltip.tsx's structure.
'use client';

import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { cn } from '@/lib/utils';

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  side = 'top',
  sideOffset = 6,
  align = 'center',
  children,
  ...props
}: PopoverPrimitive.Popup.Props & Pick<PopoverPrimitive.Positioner.Props, 'align' | 'side' | 'sideOffset'>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner align={align} side={side} sideOffset={sideOffset} className="isolate z-50">
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            'z-50 w-72 origin-(--transform-origin) rounded-md border bg-popover p-3 text-sm text-popover-foreground shadow-md outline-none',
            'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            className,
          )}
          {...props}
        >
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverTrigger, PopoverContent };
```

If `bg-popover`/`text-popover-foreground` tokens don't exist in `src/app/globals.css` (check first — `tooltip.tsx` uses `bg-foreground`/`text-background` instead, suggesting no `popover` token exists), use `bg-background text-foreground border` instead:

```tsx
            'z-50 w-72 origin-(--transform-origin) rounded-md border bg-background p-3 text-sm text-foreground shadow-md outline-none',
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/labels.ts src/components/ui/popover.tsx
git commit -m "feat(audit): add audit/actor labels and a click-to-open Popover primitive"
```

---

## Task 16: `<DerivedMarker>` — the "ƒ" badge

**Files:**
- Create: `src/components/audit/derived-marker.tsx`

**Interfaces:**
- Consumes: `Popover`/`PopoverTrigger`/`PopoverContent` (Task 15).
- Produces: `<DerivedMarker formula={string} inputs={string[]} />` — Task 17 renders this on the six numbers.

- [ ] **Step 1: Implement**

```tsx
// ============================================================================
// src/components/audit/derived-marker.tsx — erd.md Part 9.6
//
// The "ƒ" marker for a deterministically-computed value: a median, a
// concentration percentage, a crosscheck quantification. Distinct from
// <EvidenceChip> (which points at a document) — this points at a formula and
// the already-known inputs it was computed from. Click or hover reveals it.
// ============================================================================

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export function DerivedMarker({ formula, inputs, className }: { formula: string; inputs: string[]; className?: string }) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          'inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-[10px] font-serif italic text-muted-foreground transition-colors hover:border-attention hover:text-attention-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          className,
        )}
        aria-label="Show how this value was derived"
      >
        ƒ
      </PopoverTrigger>
      <PopoverContent>
        <p className="font-medium">{formula}</p>
        <p className="mt-1 text-xs text-muted-foreground">Computed · deterministic</p>
        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {inputs.map((input) => (
            <li key={input}>{input}</li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/audit/derived-marker.tsx
git commit -m "feat(audit): add the DerivedMarker (ƒ) component"
```

---

## Task 17: Wire `<DerivedMarker>` onto the six interrogated numbers

**Files:**
- Modify: `src/components/analysis/benchmark-panel.tsx` (3 medians)
- Modify: `src/components/analysis/portfolio-panel.tsx` (concentration percentages)
- Modify: `src/components/decision/crosscheck-card.tsx` (both quantifications — this component renders one `Crosscheck`, so one marker per render covers both of the app's crosscheck instances)

**Interfaces:**
- Consumes: `<DerivedMarker>` (Task 16).

- [ ] **Step 1: Benchmark medians**

In `src/components/analysis/benchmark-panel.tsx`, import `DerivedMarker`, and change the median cell:

```tsx
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    <span className="inline-flex items-center justify-end gap-1">
                      {fmtValue(row.peerMedian, row.unit)}
                      <DerivedMarker
                        formula={`Median of ${row.peerValues.length} peer values`}
                        inputs={row.peerValues.map((pv) => {
                          const peer = benchmark.peers.find((p) => p.id === pv.peerId);
                          return `${peer?.name ?? pv.peerId}: ${fmtValue(pv.value, row.unit)}`;
                        })}
                      />
                    </span>
                  </TableCell>
```

- [ ] **Step 2: Portfolio concentration percentages**

In `src/components/analysis/portfolio-panel.tsx`, import `DerivedMarker`. The "concentration percentages" are `beforePct`/`afterPct`; put one marker at the row level next to the sector label (covering both bars, since both are visible together) rather than duplicating it on each bar:

```tsx
                <div className="flex items-center justify-between">
                  <span className={cn('inline-flex items-center gap-1.5 text-sm', c.isTargetSector ? 'font-semibold' : 'text-muted-foreground')}>
                    {c.sector}
                    <DerivedMarker
                      formula={`${c.sector} share of committed capital: sector total ÷ portfolio total × 100`}
                      inputs={[
                        `Before: $${c.beforeUsdM}m ÷ $${portfolio.totalBeforeUsdM}m = ${fmtPct(c.beforePct)}`,
                        `After: $${c.afterUsdM}m ÷ $${portfolio.totalAfterUsdM}m = ${fmtPct(c.afterPct)}`,
                      ]}
                    />
                  </span>
                  {c.isTargetSector && (
```

(Keep the existing `{c.isTargetSector && (...)}` delta span that follows — only the opening `<span>...</span>` line and its contents change; the closing structure is unchanged.)

- [ ] **Step 3: Crosscheck quantifications**

In `src/components/decision/crosscheck-card.tsx`, import `DerivedMarker`, and add it next to the "Observed" figure (the value WinBack itself computed — `claimedValue` is management's claim, not derived):

```tsx
            <div>
              <div className="text-xs text-muted-foreground">Observed</div>
              <div className="inline-flex items-center gap-1 font-heading text-2xl tabular-nums">
                {crosscheck.quantification.observedValue}
                {crosscheck.quantification.unit}
                <DerivedMarker formula={crosscheck.quantification.label} inputs={[crosscheck.quantification.note]} />
              </div>
            </div>
```

- [ ] **Step 4: Typecheck and visual sanity check**

Run: `npm run typecheck`
Then run the app (`npm run dev`) and manually walk Plan → Ingest → Analysis → Decision with a mock/live run, confirming all three "ƒ" markers render and their popovers show sensible text.

- [ ] **Step 5: Commit**

```bash
git add src/components/analysis/benchmark-panel.tsx src/components/analysis/portfolio-panel.tsx src/components/decision/crosscheck-card.tsx
git commit -m "feat(audit): add derived-value ƒ markers to benchmark medians, concentration %, and crosscheck quantifications"
```

---

## Task 18: `/deal/[id]/audit` page + `<AuditTimeline>` + Sidebar link

**Files:**
- Create: `src/components/audit/audit-timeline.tsx`
- Create: `src/app/deal/[id]/audit/page.tsx`
- Modify: `src/components/app-shell/sidebar.tsx`

**Interfaces:**
- Consumes: `GET /api/runs/[id]/audit` (Task 14), `AUDIT_ACTION_LABEL`/`ACTOR_LABEL` (Task 15), `AuditListResponseSchema` (Task 2).

- [ ] **Step 1: The timeline component**

```tsx
// ============================================================================
// src/components/audit/audit-timeline.tsx — erd.md Part 9.6
//
// Reverse-chronological (the API already returns newest-first). Renders
// standalone against a runId — no dependency on the client-side Run object,
// so it works even after sign-out/sign-in on a fresh browser.
// ============================================================================

'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AuditListResponseSchema } from '@/lib/contracts/schemas';
import type { AuditAction, AuditEntry } from '@/lib/contracts/types';
import { AUDIT_ACTION_LABEL, ACTOR_LABEL } from '@/lib/labels';

const ACTOR_FILTERS = ['all', 'system', 'model', 'analyst'] as const;

function actorBadgeClass(actor: AuditEntry['actor']): string {
  if (actor === 'analyst') return 'border-primary/40 bg-primary/15 text-primary';
  if (actor === 'model') return 'border-attention/40 bg-attention/15 text-attention-foreground';
  return 'border-border bg-muted text-muted-foreground';
}

export function AuditTimeline({ runId }: { runId: string }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actorFilter, setActorFilter] = useState<(typeof ACTOR_FILTERS)[number]>('all');
  const [actionFilter, setActionFilter] = useState<AuditAction | 'all'>('all');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const qs = actionFilter === 'all' ? '' : `?action=${actionFilter}`;
        const res = await fetch(`/api/runs/${runId}/audit${qs}`);
        const json = await res.json();
        const parsed = AuditListResponseSchema.safeParse(json);
        if (cancelled) return;
        if (!parsed.success || !parsed.data.ok) {
          setError('Could not load the audit trail.');
          return;
        }
        setEntries(parsed.data.data.entries);
      } catch {
        if (!cancelled) setError('Could not load the audit trail.');
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [runId, actionFilter]);

  async function exportTrail() {
    window.open(`/api/runs/${runId}/audit/export`, '_blank');
  }

  if (error) return <p className="text-sm text-muted-foreground">{error}</p>;
  if (entries === null) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const visible = actorFilter === 'all' ? entries : entries.filter((e) => e.actor === actorFilter);

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No activity yet. Every extraction, comparison, and analyst decision will be recorded here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={actorFilter} onValueChange={(v) => setActorFilter(v as (typeof ACTOR_FILTERS)[number])}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Actor" />
          </SelectTrigger>
          <SelectContent>
            {ACTOR_FILTERS.map((a) => (
              <SelectItem key={a} value={a}>
                {a === 'all' ? 'All actors' : ACTOR_LABEL[a]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as AuditAction | 'all')}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {Object.entries(AUDIT_ACTION_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="ml-auto" onClick={exportTrail}>
          Export
        </Button>
      </div>

      <ul className="space-y-2">
        {visible.map((entry) => (
          <li key={entry.id} className="rounded-lg border px-3 py-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{new Date(entry.at).toLocaleString()}</span>
              <Badge variant="outline" className={actorBadgeClass(entry.actor)}>
                {ACTOR_LABEL[entry.actor]}
              </Badge>
              <span>{AUDIT_ACTION_LABEL[entry.action] ?? entry.action}</span>
              {entry.stage && <span>· {entry.stage}</span>}
            </div>
            {entry.statementText && <p className="mt-1 text-sm">{entry.statementText}</p>}
            {entry.note && <p className="mt-1 text-sm text-muted-foreground">{entry.note}</p>}
            {(entry.before || entry.after) && (
              <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                {entry.before && (
                  <p className="text-muted-foreground">
                    <span className="font-medium">Before:</span> {entry.before}
                  </p>
                )}
                {entry.after && (
                  <p className="text-muted-foreground">
                    <span className="font-medium">After:</span> {entry.after}
                  </p>
                )}
              </div>
            )}
            {entry.provenance && (
              <details className="mt-1 text-xs text-muted-foreground">
                <summary className="cursor-pointer">Provenance</summary>
                <p>Produced by: {entry.provenance.producedBy}</p>
                <p>Prompt version: {entry.provenance.promptVersion ?? '—'}</p>
                <p>Input hash: {entry.provenance.inputHash}</p>
                <p>Latency: {entry.provenance.latencyMs !== null ? `${entry.provenance.latencyMs}ms` : '—'}</p>
              </details>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: The page**

```tsx
// ============================================================================
// src/app/deal/[id]/audit/page.tsx — erd.md Part 9.6
//
// Deliberately NOT under DealGate (see the (pipeline) route group in
// src/app/deal/[id]/(pipeline)/) — this reads straight from the server via
// GET /api/runs/[id]/audit, which is ownership-checked independently of any
// client-side Run object. Works after sign-out/sign-in on any browser, for
// any run this user owns.
// ============================================================================

import { AuditTimeline } from '@/components/audit/audit-timeline';

export default async function AuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Audit trail</h1>
        <p className="text-sm text-muted-foreground">
          A complete, exportable record of what was generated, from what sources, by what model and prompt version, and
          what the analyst did about it. Not tamper-proof and not a compliance-grade log — see the README for the exact
          claim this makes.
        </p>
      </div>
      <AuditTimeline runId={id} />
    </div>
  );
}
```

- [ ] **Step 3: Sidebar link**

In `src/components/app-shell/sidebar.tsx`, add to the `items` array, after `'Decision'`:

```ts
    { label: 'Decision', href: `/deal/${run.id}/decision`, disabled: !run.deal },
    { label: 'Audit Trail', href: `/deal/${run.id}/audit`, disabled: !run.deal },
    { label: 'Knowledge Graph', href: '/graph', disabled: false },
```

- [ ] **Step 4: Typecheck, build, and manual verification**

Run: `npm run typecheck && npm run build`
Expected: clean. Then `npm run dev`, run a deal through Ingest → Analysis → Decision, click "Audit Trail" in the sidebar, confirm entries appear newest-first with actor badges and expandable provenance, accept/dismiss a crosscheck and confirm a new `analyst_accepted`/`analyst_dismissed` entry appears on reload, click Export and confirm a JSON file downloads.

Then, the scenario the user actually asked for: sign out, sign back in, navigate directly to `/deal/<that id>/audit` (bookmark or retype the URL) without visiting Ingest/Analysis/Decision first — confirm the trail still renders.

- [ ] **Step 5: Commit**

```bash
git add src/components/audit/audit-timeline.tsx "src/app/deal/[id]/audit/page.tsx" src/components/app-shell/sidebar.tsx
git commit -m "feat(audit): add the /deal/[id]/audit view and sidebar link"
```

---

## Self-Review Notes

**Spec coverage against erd.md Part 9:**
- §9.1 Guarantee 1 (cited/derived/unsourced) — the "ƒ" derived markers (Task 16-17) cover the explicitly-named six numbers. `assertSourced()`/dev-mode unsourced warnings are **not** built — erd.md scopes that to development-time linting of the whole render tree, which is a larger, separate effort or the user didn't ask for it; flagging as an explicit gap rather than silently including a partial version.
- §9.1 Guarantee 2 (every action recorded) — all listed action types are wired: stage start/complete/fail (Tasks 5-8), statement_generated (Tasks 5-8), evidence_dropped (Task 5), analyst accept/dismiss/edit (Task 11), memo_status_changed (Task 11), session_viewed (Task 12). `session_created` is emitted implicitly (the first `ensureRun` upsert in `recordAudit`, on whichever stage runs first) rather than from a dedicated call — documented in Task 5's design. `session_deleted` has no corresponding product feature (no delete UI exists) and is intentionally not implemented — the DB schema and `AuditAction` enum both still support it if that feature is added later.
- §9.2 Storage — Postgres table instead of a Firestore subcollection (stack has moved to Supabase); append-only via RLS policy absence of UPDATE/DELETE, monotonic sortable id, indexed by `(run_id, id desc)`. Covered in Task 1.
- §9.3 Writing the trail — `recordAudit()` (Task 4), batched per stage via array inserts, `inputHash` reused as-is from each stage's existing `Provenance` (no new hashing logic needed — already computed by every pipeline route).
- §9.4 Prompt versioning — already existed before this plan (`PROMPT_VERSION` constants visible in `benchmark/route.ts` etc.); nothing new needed here, `provenance.promptVersion` is threaded straight into `run_audit.provenance` jsonb.
- §9.5 Routes — `GET /api/runs/[id]/audit` and `/export` (Tasks 13-14), same 404-not-403 rule as the existing graph route.
- §9.6 UI — derived markers (16-17) + full audit view (18), reachable from the sidebar on every deal screen.
- §9.7 "What this is not" — the audit page's copy (Task 18, Step 2) states the same caveat inline; a fuller README section is a docs-only follow-up not included in this plan (no README currently documents Phase 6 at all — out of scope here).

**Placeholder scan:** no "TBD"/"handle appropriately" left in any step; every code block is complete, runnable code, not a description of code.

**Type consistency check:** `AuditEntryDraft` (Task 4) fields match exactly what every route (Tasks 5-9) passes; `recordAuditEvent`'s input shape (Task 10) matches `AuditEventRequestSchema` (Task 2) field-for-field; `AuditSource`/`RunRow`/`AuditListOptions` (Task 13) match what `supabase-source.ts` (Task 14) constructs; `DerivedMarker`'s props (`formula`, `inputs`) are used identically across all three call sites (Task 17).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-05-audit-trail.md`.
