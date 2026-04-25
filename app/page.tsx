"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { DiagnoseForm } from "@/components/DiagnoseForm";
import { LoadingState } from "@/components/LoadingState";
import { DiagnosisOutput } from "@/components/DiagnosisOutput";
import { EmailCapture } from "@/components/EmailCapture";
import { MOCK_DIAGNOSIS } from "@/lib/mock";
import type { DiagnoseResponse, DiagnosisJson } from "@/lib/types";

type RecentRun = {
  url: string;
  keyword: string;
  share_token: string;
  generated_at: number;
};

type Stage =
  | { kind: "form" }
  | { kind: "loading" }
  | { kind: "result"; diagnosis: DiagnosisJson; share_token: string }
  | { kind: "rate_limited" }
  | { kind: "cap_reached" }
  | { kind: "error"; message: string };

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeInner />
    </Suspense>
  );
}

function HomeInner() {
  const searchParams = useSearchParams();
  const isMock = searchParams.get("mock") === "1";

  const [stage, setStage] = useState<Stage>(
    isMock
      ? { kind: "result", diagnosis: MOCK_DIAGNOSIS, share_token: "mock-token" }
      : { kind: "form" },
  );
  const [capStatus, setCapStatus] = useState<{
    total: number;
    cap: number;
    closed: boolean;
  } | null>(null);
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);
  const [optedInToExamples, setOptedInToExamples] = useState(false);

  // pull cap-status on form mount
  useEffect(() => {
    let aborted = false;
    fetch("/api/cap-status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!aborted && data) setCapStatus(data);
      })
      .catch(() => {});
    return () => {
      aborted = true;
    };
  }, []);

  async function handleSubmit({ url, keyword }: { url: string; keyword: string }) {
    setStage({ kind: "loading" });
    setOptedInToExamples(false);

    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, keyword, optInToExamples: false }),
      });

      const data: DiagnoseResponse = await res.json();

      if (data.ok) {
        setStage({
          kind: "result",
          diagnosis: data.diagnosis,
          share_token: data.share_token,
        });
        setRecentRuns((prev) => [
          {
            url: data.diagnosis.url,
            keyword: data.diagnosis.keyword,
            share_token: data.share_token,
            generated_at: data.diagnosis.generated_at,
          },
          ...prev,
        ]);
        return;
      }

      if (data.reason === "rate_limited") {
        setStage({ kind: "rate_limited" });
      } else if (data.reason === "cap_reached") {
        setStage({ kind: "cap_reached" });
      } else {
        setStage({ kind: "error", message: data.message || "something went wrong." });
      }
    } catch (err) {
      setStage({
        kind: "error",
        message: err instanceof Error ? err.message : "something went wrong.",
      });
    }
  }

  async function handleOptInChange(optIn: boolean) {
    setOptedInToExamples(optIn);
    if (stage.kind !== "result") return;
    // option B opt-in flow: dedicated endpoint flips the row's optedInToExamples flag.
    // best-effort — opt-in is non-critical to the UI; we don't surface failure.
    try {
      await fetch("/api/diagnose-optin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          share_token: stage.share_token,
          optedIn: optIn,
        }),
      });
    } catch {
      /* swallow */
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-1 flex-col px-5 pt-10 pb-20 md:px-8 md:pt-16">
      <Header capStatus={capStatus} />

      <Hero />

      <div className="mt-10 md:mt-14">
        {stage.kind === "form" && (
          <DiagnoseForm onSubmit={handleSubmit} />
        )}

        {stage.kind === "loading" && <LoadingState />}

        {stage.kind === "result" && (
          <div className="space-y-10">
            <DiagnosisOutput
              diagnosis={stage.diagnosis}
              shareToken={stage.share_token}
              interactive
              capStatus={capStatus ?? undefined}
              onOptInChange={handleOptInChange}
            />

            <div className="pt-4 border-t border-border-soft">
              <button
                onClick={() => setStage({ kind: "form" })}
                className="text-sm text-text-soft hover:text-text underline underline-offset-4 decoration-text-muted/40 hover:decoration-text-soft"
              >
                run another diagnosis
              </button>
            </div>
          </div>
        )}

        {stage.kind === "rate_limited" && <EmailCapture variant="rate_limited" />}
        {stage.kind === "cap_reached" && <EmailCapture variant="cap_reached" />}

        {stage.kind === "error" && (
          <div className="rounded-[12px] border border-border bg-bg-card p-6">
            <p className="text-[11px] uppercase tracking-[0.22em] text-severity-critical mb-2">
              something went wrong
            </p>
            <p className="text-[15px] text-text-soft leading-relaxed">
              {stage.message}
            </p>
            <button
              onClick={() => setStage({ kind: "form" })}
              className="mt-5 rounded-[12px] border border-border bg-bg px-4 py-2.5 text-sm text-text hover:border-text-soft"
            >
              try again
            </button>
          </div>
        )}
      </div>

      {recentRuns.length > 0 && stage.kind === "result" && (
        <RecentRuns runs={recentRuns} />
      )}

      <Footer />

      {/* keep optedInToExamples reachable so unused-var lint stays quiet */}
      <span className="sr-only">{optedInToExamples ? "opted-in" : ""}</span>
    </div>
  );
}

function Header({
  capStatus,
}: {
  capStatus: { total: number; cap: number; closed: boolean } | null;
}) {
  return (
    <header className="flex items-center justify-between">
      <Link href="/" className="text-sm font-medium tracking-[-0.01em] text-text">
        rankdoctor
      </Link>
      <nav className="flex items-center gap-5 text-[13px] text-text-soft">
        <Link href="/examples" className="hover:text-text">
          examples
        </Link>
        {capStatus && (
          <span className="text-text-muted tabular-nums">
            {capStatus.total}/{capStatus.cap}
          </span>
        )}
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="pt-14 md:pt-20">
      <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted mb-5">
        a doctor for your dropped rankings
      </p>
      <h1 className="text-[40px] md:text-[56px] leading-[1.02] tracking-[-0.025em] text-text font-medium">
        your ranking dropped.
        <br />
        <span className="text-text-soft">things are going to be okay.</span>
      </h1>
      <p className="mt-6 max-w-prose text-[16px] md:text-[17px] leading-relaxed text-text-soft">
        paste the page that lost ground and the keyword it was ranking for. we&apos;ll
        check the SERP, page history, pagespeed, and recent algo updates, then return
        a ranked list of likely causes — each with a specific fix.
      </p>
    </section>
  );
}

function RecentRuns({ runs }: { runs: RecentRun[] }) {
  return (
    <section className="mt-14 pt-8 border-t border-border-soft">
      <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted mb-4">
        this session
      </p>
      <ul className="space-y-2">
        {runs.map((r) => (
          <li key={r.share_token} className="flex items-center justify-between gap-4 text-[14px]">
            <Link
              href={`/d/${r.share_token}`}
              className="truncate text-text-soft hover:text-text"
            >
              <span className="text-text">{tryHostname(r.url)}</span>
              <span className="mx-2 text-text-muted">·</span>
              <span>{r.keyword}</span>
            </Link>
            <span className="font-mono text-[11px] text-text-muted shrink-0">
              {new Date(r.generated_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-20 pt-8 border-t border-border-soft flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
      <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted">
        rankdoctor · weekend beta
      </p>
      <a
        href="mailto:hello@growthx.club"
        className="text-[11px] uppercase tracking-[0.22em] text-text-soft hover:text-text"
      >
        hello@growthx.club
      </a>
    </footer>
  );
}

function tryHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
