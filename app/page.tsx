"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { DiagnoseForm } from "@/components/DiagnoseForm";
import { LoadingState } from "@/components/LoadingState";
import { DiagnosisOutput } from "@/components/DiagnosisOutput";
import { EmailCapture } from "@/components/EmailCapture";
import { PillNav } from "@/components/PillNav";
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

  const [stage, setStage] = useState<Stage>({ kind: "form" });
  const [capStatus, setCapStatus] = useState<{
    total: number;
    cap: number;
    closed: boolean;
  } | null>(null);
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);

  // ?mock=1 — dynamic-import the mock so it doesn't ship to every user.
  useEffect(() => {
    if (!isMock) return;
    let aborted = false;
    import("@/lib/mock").then(({ MOCK_DIAGNOSIS }) => {
      if (!aborted) {
        setStage({
          kind: "result",
          diagnosis: MOCK_DIAGNOSIS,
          share_token: "mock-token",
        });
      }
    });
    return () => {
      aborted = true;
    };
  }, [isMock]);

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

  // Form stage gets the light/mobbin treatment. Loading + result + error +
  // email-capture stages keep the dark layout (the diagnosis cards are
  // scope-locked dark; redesigning them is a separate pass).
  if (stage.kind === "form") {
    return (
      <FormView
        onSubmit={handleSubmit}
        capStatus={capStatus}
      />
    );
  }

  // Non-form stages: light layout, same pill nav as the form view.
  const capLabel = capStatus ? `${capStatus.total}/${capStatus.cap}` : undefined;
  return (
    <div className="min-h-screen w-full bg-bg text-text">
      <div className="mx-auto flex min-h-screen w-full max-w-[1200px] flex-col px-6 pt-6 pb-12 md:px-10 md:pt-8">
        <PillNav rightLabel={capLabel} />

        <div className="mx-auto w-full max-w-[820px] mt-12 md:mt-16 flex-1">
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
                  Run another diagnosis
                </button>
              </div>
            </div>
          )}

          {stage.kind === "rate_limited" && <EmailCapture variant="rate_limited" />}
          {stage.kind === "cap_reached" && <EmailCapture variant="cap_reached" />}

          {stage.kind === "error" && (
            <div className="rounded-[12px] border border-border bg-bg-card p-6">
              <p className="text-[11px] uppercase tracking-[0.22em] text-severity-critical mb-2">
                Something went wrong
              </p>
              <p className="text-[15px] text-text-soft leading-relaxed">
                {stage.message}
              </p>
              <button
                onClick={() => setStage({ kind: "form" })}
                className="mt-5 rounded-[12px] border border-border bg-bg px-4 py-2.5 text-sm text-text hover:border-text-soft"
              >
                Try again
              </button>
            </div>
          )}

          {recentRuns.length > 0 && stage.kind === "result" && (
            <RecentRuns runs={recentRuns} />
          )}
        </div>

        <Footer />
      </div>
    </div>
  );
}

function FormView({
  onSubmit,
  capStatus,
}: {
  onSubmit: (input: { url: string; keyword: string }) => void;
  capStatus: { total: number; cap: number; closed: boolean } | null;
}) {
  return (
    <div className="min-h-screen w-full bg-bg text-text overflow-x-hidden">
      <div className="mx-auto flex min-h-screen w-full max-w-[1200px] flex-col px-6 pt-6 pb-12 md:px-10 md:pt-8">
        <PillNav rightLabel={capStatus ? `${capStatus.total}/${capStatus.cap}` : undefined} />

        {/* hero — sized to fit above the fold (everything from doctor-sign
            to the diagnose button visible in the first viewport). */}
        <section className="flex flex-1 flex-col items-center justify-center pt-6 pb-8 text-center md:pt-8 md:pb-10">
          <DoctorSign />
          <EkgBackdrop />
          <h1 className="font-bold tracking-[-0.045em] leading-[0.95] text-[40px] sm:text-[56px] md:text-[72px] lg:text-[88px] max-w-[12ch] text-balance text-text">
            ER for crashed rankings.
          </h1>

          <p className="mt-5 max-w-[52ch] text-[15px] md:text-[17px] leading-[1.5] text-text-soft text-balance">
            A diagnosis in about 90 seconds — 3-5 causes ranked critical to mild,
            with a prescription for each.
          </p>

          {/* form */}
          <div className="mt-7 md:mt-8 w-full max-w-[640px]">
            <DiagnoseForm onSubmit={onSubmit} />
          </div>
        </section>

        {/* what we check — below the form per scope */}
        <section className="border-t border-border-soft pt-12 pb-12">
          <p className="mb-8 text-center text-[12px] font-medium uppercase tracking-[0.18em] text-text-muted">
            What we check
          </p>
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-6 max-w-[960px] mx-auto">
            <CheckItem
              n="01"
              title="The SERP"
              body="Where you rank now and who's beating you for the keyword."
            />
            <CheckItem
              n="02"
              title="Page changes"
              body="What's different on your page since the last good ranking."
            />
            <CheckItem
              n="03"
              title="Core web vitals"
              body="LCP, INP, CLS — and whether they slipped recently."
            />
            <CheckItem
              n="04"
              title="Google updates"
              body="Confirmed core and spam updates within the last 90 days."
            />
          </div>
        </section>

        {/* footer */}
        <footer className="mt-auto pt-10 flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between text-[13px] text-text-muted">
          <span>Rankdoctor — weekend beta.</span>
          <Link
            href="/waitlist"
            className="hover:text-text underline-offset-4 hover:underline"
          >
            Join the v2 waitlist →
          </Link>
        </footer>
      </div>
    </div>
  );
}

// Hospital-corridor "ready" sign — pulsing green dot + status text, like
// the placard outside an exam room when the doctor calls you in. Sits above
// the EKG strip in the hero. Decorative; no real state behind it.
function DoctorSign() {
  return (
    <div
      className="mb-3 md:mb-4 inline-flex items-center gap-2 rounded-full bg-[#F4F4F2] pl-2.5 pr-3.5 py-1.5 shadow-[0_1px_0_rgba(0,0,0,0.04),0_6px_18px_-10px_rgba(0,0,0,0.12)]"
      aria-hidden
    >
      <span className="relative inline-flex h-1.5 w-1.5">
        <span className="absolute inset-0 inline-flex h-1.5 w-1.5 animate-ping rounded-full bg-emerald-500/70" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
      </span>
      <span className="text-[11px] md:text-[12px] font-medium tracking-[-0.005em] text-text-soft">
        The doctor will see you now
      </span>
    </div>
  );
}

// Decorative ER-monitor strip — sits above the headline like an actual
// monitor display above the patient. Heartbeat spikes for "ranking healthy",
// then a sharp drop on the right for "ranking crashed" — mirrors the page's
// pitch in shape. Pure SVG + CSS animation; no real data behind it.
function EkgBackdrop() {
  return (
    <div
      className="pointer-events-none mb-4 md:mb-5 flex w-full justify-center overflow-hidden"
      aria-hidden
    >
      <svg
        viewBox="0 0 1200 280"
        preserveAspectRatio="xMidYMid meet"
        className="w-full max-w-[760px] h-[60px] md:h-[80px]"
      >
        <defs>
          <linearGradient id="ekg-gradient" x1="0" y1="0" x2="1" y2="0">
            {/* full story arc, mapped to the new ranking-chart path geometry:
                healthy plateau → warning → crash → recovering → recovered */}
            <stop offset="0%" stopColor="#34D399" stopOpacity="0.55" />
            <stop offset="55%" stopColor="#34D399" stopOpacity="0.6" />
            <stop offset="65%" stopColor="#F59E0B" stopOpacity="0.6" />
            <stop offset="74%" stopColor="#EF4444" stopOpacity="0.8" />
            <stop offset="86%" stopColor="#F59E0B" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.9" />
          </linearGradient>
          <style>{`
            @keyframes ekg-draw {
              0% { stroke-dashoffset: 4000; }
              80% { stroke-dashoffset: 0; }
              100% { stroke-dashoffset: 0; }
            }
            @keyframes pulse-dot {
              0%, 70% { opacity: 0; transform: scale(0.6); }
              80% { opacity: 1; transform: scale(1.2); }
              100% { opacity: 0.6; transform: scale(1); }
            }
            .ekg-path {
              stroke-dasharray: 4000;
              stroke-dashoffset: 4000;
              animation: ekg-draw 7s cubic-bezier(0.65, 0, 0.35, 1) infinite;
            }
            .ekg-pulse {
              transform-origin: center;
              transform-box: fill-box;
              animation: pulse-dot 7s cubic-bezier(0.65, 0, 0.35, 1) infinite;
            }
          `}</style>
        </defs>
        {/* SEO ranking chart shape (not heartbeat):
              healthy plateau with natural day-to-day micro-noise →
              sharp crash → bottom flat (diagnosis) →
              smooth recovery curve climbing back above the baseline */}
        <path
          className="ekg-path"
          d="
            M 0 128
            L 90 124
            L 180 132
            L 270 122
            L 360 130
            L 450 120
            L 540 128
            L 630 118
            L 720 130
            L 780 138
            L 870 248
            L 920 248
            C 980 225, 1040 195, 1100 145
            L 1180 95
          "
          fill="none"
          stroke="url(#ekg-gradient)"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* end-of-line pulse dot — sits at the recovered position, pulses
            green to signal "back to healthy / better than before". */}
        <circle
          className="ekg-pulse"
          cx="1180"
          cy="95"
          r="6"
          fill="#10B981"
        />
      </svg>
    </div>
  );
}

function CheckItem({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium tracking-[0.18em] text-black/55">{n}</p>
      <h3 className="mt-2 text-[16px] md:text-[17px] font-semibold tracking-tight text-black">
        {title}
      </h3>
      <p className="mt-1.5 text-[13px] md:text-[14px] leading-[1.5] text-black/65">{body}</p>
    </div>
  );
}

function RecentRuns({ runs }: { runs: RecentRun[] }) {
  return (
    <section className="mt-14 pt-8 border-t border-border-soft">
      <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted mb-4">
        This session
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
        Rankdoctor · weekend beta
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
