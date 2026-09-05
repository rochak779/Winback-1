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
