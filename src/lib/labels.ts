// Shared display labels for enum-shaped contract fields, used by both the
// Ingest and Decision screens.
export const WORKSTREAM_LABEL: Record<string, string> = {
  financial: 'Financial',
  commercial: 'Commercial',
  legal: 'Legal',
  tax: 'Tax',
  hr: 'HR',
  operations: 'Operations',
  unknown: 'Unclassified',
};

export const CROSSCHECK_STATUS_LABEL: Record<string, string> = {
  contradiction_found: 'Inconsistency identified',
  consistent: 'Consistent with the records',
  inconclusive: 'Inconclusive',
};

/**
 * Purely descriptive — erd.md Part 6 §6.6: "above-median EV/EBITDA means the
 * target is expensive, not excellent." Never render these as good/bad.
 */
export const BENCHMARK_DIRECTION_LABEL: Record<string, string> = {
  above: 'Above peer median',
  below: 'Below peer median',
  inline: 'In line with peer median',
  unknown: 'Not determined',
};

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
