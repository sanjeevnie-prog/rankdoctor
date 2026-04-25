export type Severity = "critical" | "high" | "medium";

export type DiagnosisCause = {
  severity: Severity;
  headline: string;
  explanation: string;
  fix: string;
  confidence?: number;
};

export type DiagnosisRankInfo =
  | { history_available: true; current_rank: number | null; prior_rank: number; drop: number }
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

export type DiagnoseRequest = {
  url: string;
  keyword: string;
  priorRank?: number;
};

export type DiagnoseResponse =
  | { ok: true; diagnosis: DiagnosisJson; share_token: string }
  | { ok: false; reason: "rate_limited" | "cap_reached" | "internal_error"; message: string };
