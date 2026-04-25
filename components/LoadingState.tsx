"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "fetching SERP position",
  "checking page history on wayback",
  "running pagespeed",
  "cross-referencing algo updates",
  "synthesizing diagnosis",
];

export function LoadingState() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i = Math.min(i + 1, STEPS.length - 1);
      setActiveIndex(i);
    }, 4500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-[12px] border border-border bg-bg-card p-6 md:p-7 fade-up">
      <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted mb-5">
        examining the patient
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
        about 15-30 seconds. don&apos;t close the tab.
      </p>
    </div>
  );
}
