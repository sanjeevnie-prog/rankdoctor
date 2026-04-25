"use client";

import { useState } from "react";
import type { DiagnosisJson } from "@/lib/types";
import { DiagnosisCard } from "./DiagnosisCard";
import { ShareCardPreview } from "./ShareCardPreview";

export type DiagnosisOutputProps = {
  diagnosis: DiagnosisJson;
  shareToken?: string;
  /** when true, render share button + opt-in checkbox + beta-counter line */
  interactive?: boolean;
  /** for the beta-counter; if undefined, don't render the counter line */
  capStatus?: { total: number; cap: number };
  /** called when user toggles the opt-in checkbox; parent owns persistence */
  onOptInChange?: (optIn: boolean) => void;
};

function severityRank(s: DiagnosisJson["causes"][number]["severity"]): number {
  if (s === "critical") return 0;
  if (s === "high") return 1;
  return 2;
}

export function DiagnosisOutput({
  diagnosis,
  shareToken,
  interactive,
  capStatus,
  onOptInChange,
}: DiagnosisOutputProps) {
  const [optIn, setOptIn] = useState(false);

  const sortedCauses = [...diagnosis.causes].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity),
  );

  const rank = diagnosis.rank_info;
  const showRankHero =
    rank.history_available && typeof rank.current_rank === "number";

  const shareUrl =
    shareToken && typeof window !== "undefined"
      ? `${window.location.origin}/d/${shareToken}`
      : shareToken
        ? `/d/${shareToken}`
        : null;

  const tweetIntent = shareUrl
    ? `https://twitter.com/intent/tweet?${new URLSearchParams({
        text: `i ran a diagnosis on why "${diagnosis.keyword}" dropped on ${tryHostname(diagnosis.url)}. here's what rankdoctor found:`,
        url: shareUrl,
      }).toString()}`
    : null;

  return (
    <div className="space-y-8">
      {/* hero rank info */}
      <section className="rounded-[12px] border border-border bg-bg-card p-6 md:p-8 fade-up">
        <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted">
          Diagnosis
        </p>
        <p className="mt-1 text-[14px] text-text-soft truncate">
          <span className="text-text">{tryHostname(diagnosis.url)}</span>
          <span className="mx-2 text-text-muted">·</span>
          <span>{diagnosis.keyword}</span>
        </p>

        <div className="mt-6 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          {showRankHero && rank.history_available ? (
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted mb-2">
                Position drop
              </p>
              <div className="flex items-baseline gap-3 text-text">
                <span className="text-5xl md:text-6xl font-semibold tabular-nums tracking-[-0.03em]">
                  {rank.prior_rank}
                </span>
                <span className="text-2xl text-text-muted">→</span>
                <span className="text-5xl md:text-6xl font-semibold tabular-nums tracking-[-0.03em] text-severity-critical">
                  {rank.current_rank}
                </span>
              </div>
              <p className="mt-2 text-xs text-text-muted">
                Down {rank.drop} positions
              </p>
            </div>
          ) : (
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted mb-2">
                Current position
              </p>
              <div className="text-5xl md:text-6xl font-semibold tabular-nums tracking-[-0.03em] text-text">
                {rank.current_rank ?? "—"}
              </div>
              <p className="mt-2 text-xs text-text-muted">
                No prior history available — diagnosis based on page + algo signals only.
              </p>
            </div>
          )}

          <div className="md:max-w-sm">
            <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted mb-2">
              Expected recovery
            </p>
            <p className="text-[15px] leading-relaxed text-severity-medium">
              {diagnosis.expected_recovery}
            </p>
          </div>
        </div>
      </section>

      {/* cards */}
      <section className="space-y-4">
        {sortedCauses.map((cause, i) => (
          <DiagnosisCard key={i} cause={cause} index={i} />
        ))}
      </section>

      {/* data gaps */}
      {diagnosis.data_gaps.length > 0 && (
        <section className="rounded-[12px] border border-border-soft bg-bg-raised p-5">
          <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted mb-3">
            Data gaps
          </p>
          <ul className="space-y-2">
            {diagnosis.data_gaps.map((g, i) => (
              <li key={i} className="text-[13px] text-text-soft">
                <span className="text-text-muted">{g.source}:</span> {g.reason}
              </li>
            ))}
          </ul>
        </section>
      )}

      {interactive && (
        <section className="space-y-6 pt-2">
          {/* share card preview — same image that travels as the OG/twitter card */}
          <ShareCardPreview diagnosis={diagnosis} />

          {tweetIntent && (
            <a
              href={tweetIntent}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-[12px] border border-border bg-bg-card px-4 py-2.5 text-sm text-text hover:border-text-soft transition-colors"
            >
              Tweet this diagnosis
            </a>
          )}

          {/* opt-in lives below the share — separate concern from sharing */}
          <label className="flex items-start gap-2.5 cursor-pointer select-none pt-2">
            <input
              type="checkbox"
              checked={optIn}
              onChange={(e) => {
                setOptIn(e.target.checked);
                onOptInChange?.(e.target.checked);
              }}
              className="mt-[3px] h-4 w-4 rounded border-border bg-bg-card accent-text"
            />
            <span className="text-[13px] text-text-soft leading-relaxed">
              Ok to feature this in our public examples list. I&apos;ll be credited as the submitter.
            </span>
          </label>

          {capStatus && (
            <p className="text-xs text-text-muted">
              {capStatus.total}/{capStatus.cap} free diagnoses used this weekend.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function tryHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
