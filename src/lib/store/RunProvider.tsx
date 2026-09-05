// ============================================================================
// src/lib/store/RunProvider.tsx — erd.md Part 2 §8, Part 3 §3.7
//
// Holds the single client-side `Run` for the deal currently open. Mirrored
// to localStorage (debounced 300ms) so a page refresh on /deal/[id]/* can
// rehydrate — see src/app/deal/[id]/layout.tsx for the hydrate-or-redirect
// logic that consumes this on mount.
// ============================================================================

'use client';

import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { nanoid } from 'nanoid';
import type {
  ApiError,
  ApiMeta,
  BenchmarkResult,
  CrosscheckId,
  Deal,
  DecisionResult,
  ExtractionResult,
  IcMemo,
  PortfolioImpact,
  Run,
  SourceDoc,
  Stage,
  StageState,
} from '@/lib/contracts/types';
import { RunSchema } from '@/lib/contracts/schemas';

function idleStage(): StageState {
  return { status: 'idle', error: null, startedAt: null, finishedAt: null, mock: false };
}

export function createInitialRun(id: string): Run {
  return {
    id,
    deal: null,
    docs: [],
    extraction: null,
    benchmark: null,
    portfolio: null,
    decision: null,
    memo: null,
    stages: {
      extract: idleStage(),
      benchmark: idleStage(),
      portfolio: idleStage(),
      decision: idleStage(),
      memo: idleStage(),
    },
    createdAt: new Date().toISOString(),
    version: 1,
  };
}

// --- Actions -----------------------------------------------------------------

type StagePayloadMap = {
  extract: ExtractionResult;
  benchmark: BenchmarkResult;
  portfolio: PortfolioImpact;
  decision: DecisionResult;
  memo: IcMemo;
};

const STAGE_FIELD: Record<Stage, keyof Pick<Run, 'extraction' | 'benchmark' | 'portfolio' | 'decision' | 'memo'>> = {
  extract: 'extraction',
  benchmark: 'benchmark',
  portfolio: 'portfolio',
  decision: 'decision',
  memo: 'memo',
};

type StageSuccessAction = {
  [K in Stage]: { type: 'STAGE_SUCCESS'; stage: K; payload: StagePayloadMap[K]; meta: ApiMeta };
}[Stage];

export type RunAction =
  | { type: 'SET_DEAL'; deal: Deal }
  | { type: 'SET_DOCS'; docs: SourceDoc[] }
  | { type: 'STAGE_START'; stage: Stage }
  | StageSuccessAction
  | { type: 'STAGE_ERROR'; stage: Stage; error: ApiError }
  /** Analyst accept/dismiss/edit on a Decision-screen finding card (erd.md Part 6 §6.7). */
  | { type: 'CROSSCHECK_DECISION'; crosscheckId: CrosscheckId; decision: 'pending' | 'accepted' | 'dismissed'; note?: string | null }
  | { type: 'RESET'; id: string }
  | { type: 'HYDRATE'; run: Run };

function runReducer(run: Run, action: RunAction): Run {
  switch (action.type) {
    case 'SET_DEAL':
      // The deal's id becomes the run's id — Plan generates one id and uses it for both
      // (erd.md §6.4: "generate an id, SET_DEAL … route to /deal/[id]/ingest").
      return { ...run, id: action.deal.id, deal: action.deal };
    case 'SET_DOCS':
      return { ...run, docs: action.docs };
    case 'STAGE_START':
      return {
        ...run,
        stages: {
          ...run.stages,
          [action.stage]: { status: 'running', error: null, startedAt: new Date().toISOString(), finishedAt: null, mock: false },
        },
      };
    case 'STAGE_SUCCESS':
      return {
        ...run,
        [STAGE_FIELD[action.stage]]: action.payload,
        stages: {
          ...run.stages,
          [action.stage]: {
            status: 'done',
            error: null,
            startedAt: run.stages[action.stage].startedAt,
            finishedAt: new Date().toISOString(),
            mock: action.meta.mock,
          },
        },
      };
    case 'STAGE_ERROR':
      return {
        ...run,
        stages: {
          ...run.stages,
          [action.stage]: { ...run.stages[action.stage], status: 'error', error: action.error, finishedAt: new Date().toISOString() },
        },
      };
    case 'CROSSCHECK_DECISION':
      if (!run.decision) return run;
      return {
        ...run,
        decision: {
          ...run.decision,
          crosschecks: run.decision.crosschecks.map((c) =>
            c.id === action.crosscheckId ? { ...c, analystDecision: action.decision, analystNote: action.note ?? c.analystNote } : c,
          ),
        },
      };
    case 'RESET':
      return createInitialRun(action.id);
    case 'HYDRATE':
      return action.run;
  }
}

// --- Context -------------------------------------------------------------

interface RunContextValue {
  run: Run;
  dispatch: (action: RunAction) => void;
}

const RunContext = createContext<RunContextValue | null>(null);

function storageKey(id: string): string {
  return `winback:run:${id}`;
}

/** Best-effort read of a previously-saved run for `id`. Never throws. */
export function loadRunFromStorage(id: string): Run | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(id));
    if (!raw) return null;
    const parsed = RunSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function RunProvider({ children }: { children: ReactNode }) {
  const [run, dispatch] = useReducer(runReducer, undefined, () => createInitialRun(nanoid()));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey(run.id), JSON.stringify(run));
      } catch {
        // localStorage can throw (quota, private mode) — losing autosave is not fatal.
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [run]);

  const value = useMemo(() => ({ run, dispatch }), [run]);

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>;
}

export function useRun(): RunContextValue {
  const ctx = useContext(RunContext);
  if (!ctx) throw new Error('useRun must be used within a RunProvider');
  return ctx;
}

/** Status + error for one pipeline stage. Screens own their own retry callback. */
export function useStage(stage: Stage): { status: StageState['status']; error: ApiError | null } {
  const { run } = useRun();
  const state = run.stages[stage];
  return useMemo(() => ({ status: state.status, error: state.error }), [state.status, state.error]);
}

/** True whenever any stage of the current run used a mocked LLM call (erd.md Part 1 Rule 1). */
export function useIsMockRun(): boolean {
  const { run } = useRun();
  return Object.values(run.stages).some((s) => s.mock);
}
