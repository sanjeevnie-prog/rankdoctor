// Shared types for the SEO ranking drop diagnostic.
//
// Source-of-truth for DiagnosisJson. Imported by frontend (rendering),
// backend (request/response shapes), and brain (orchestrator output).

export type Severity = "critical" | "high" | "medium";

export type DiagnosisCause = {
  severity: Severity;
  headline: string;
  explanation: string;
  fix: string;
  confidence?: number;
};

// `drop` is allowed to be `null` when `prior_rank` is known but
// `current_rank` couldn't be determined — you can't compute a delta from
// one number alone. The frontend hides the X→Y hero in this case anyway.
export type DiagnosisRankInfo =
  | { history_available: true; current_rank: number | null; prior_rank: number; drop: number | null }
  | { history_available: false; current_rank: number | null };

export type DataGap = {
  source: "serp" | "page_html" | "wayback" | "pagespeed" | "algo_updates";
  reason: string;
};

export type DiagnosisJson = {
  url: string;
  keyword: string;
  rank_info: DiagnosisRankInfo;
  expected_recovery: string;
  causes: DiagnosisCause[];
  data_gaps: DataGap[];
  generated_at: number;
};

// What `/d/{token}` (and the OG image) receive from Convex `getByShareToken`.
// Public DiagnosisJson fields plus the share token. The validator in
// convex/diagnoses.ts is the runtime source of truth; this type mirrors it
// for callers consuming the result.
export type PublicDiagnosis = DiagnosisJson & { share_token: string };

export type DiagnoseRequest = {
  url: string;
  keyword: string;
  priorRank?: number;
};

export type DiagnoseResponse =
  | { ok: true; diagnosis: DiagnosisJson; share_token: string }
  | { ok: false; reason: "rate_limited" | "cap_reached" | "internal_error"; message: string };
