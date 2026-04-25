"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Fetching SERP position",
  "Checking page history on Wayback",
  "Running PageSpeed",
  "Cross-referencing algo updates",
  "Synthesizing diagnosis",
];

export function LoadingState() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    // 5 steps spread across ~17s so the progress doesn't sprint past
    // "synthesizing" while the backend is still working (15-30s budget).
    // Step 0 shows immediately (initial state); steps 1-4 fire on these
    // delays from mount. If the backend overshoots, the UI parks on the
    // final step rather than re-cycling.
    const ADVANCE_AT_MS = [3500, 7000, 11000, 16000];
    const timers = ADVANCE_AT_MS.map((ms, idx) =>
      setTimeout(() => setActiveIndex(idx + 1), ms),
    );
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, []);

  return (
    <div className="rounded-[12px] border border-border bg-bg-card p-6 md:p-7 fade-up">
      <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted mb-5">
        Examining the patient
      </p>
      <ul className="space-y-3">
        {STEPS.map((step, i) => {
          const isDone = i < activeIndex;
          const isActive = i === activeIndex;
          return (
            <li key={step} className="flex items-center gap-3">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  isDone
                    ? "bg-text-soft"
                    : isActive
                      ? "bg-text pulse-soft"
                      : "bg-border"
                }`}
                aria-hidden
              />
              <span
                className={`text-[14px] ${
                  isDone
                    ? "text-text-muted line-through decoration-text-muted/40"
                    : isActive
                      ? "text-text"
                      : "text-text-muted"
                }`}
              >
                {step}
                {isActive && <span className="text-text-muted">…</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-xs text-text-muted">
        About 15-30 seconds. Don&apos;t close the tab.
      </p>
    </div>
  );
}
