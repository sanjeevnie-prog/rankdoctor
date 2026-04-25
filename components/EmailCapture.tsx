"use client";

import { useState, type FormEvent } from "react";

export type EmailCaptureProps = {
  variant: "rate_limited" | "cap_reached" | "waitlist_page";
  /** override the default headline copy if you want to */
  headline?: string;
  /** override the default subline copy if you want to */
  subline?: string;
};

const COPY: Record<
  EmailCaptureProps["variant"],
  { headline: string; subline: string }
> = {
  rate_limited: {
    headline: "you've used your 5 free diagnoses.",
    subline:
      "drop your email for v2 — multi-URL tracking and weekly monitoring. we'll email you when it opens.",
  },
  cap_reached: {
    headline: "saturday's beta is closed.",
    subline:
      "we hit the 250-diagnosis weekend cap. drop your email for v2 with multi-URL tracking and weekly monitoring.",
  },
  waitlist_page: {
    headline: "weekly monitoring for your top 10 rankings.",
    subline:
      "we'll watch the rankings. you'll get a slack ping the day they drop. drop your email — we'll be in touch when v2 opens.",
  },
};

export function EmailCapture({ variant, headline, subline }: EmailCaptureProps) {
  const copy = COPY[variant];
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">(
    "idle",
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || state === "loading") return;
    setState("loading");
    try {
      const res = await fetch("/api/waitlist-v2", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source: variant }),
      });
      if (!res.ok) throw new Error("waitlist failed");
      setState("ok");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="rounded-[12px] border border-border bg-bg-card p-6 md:p-8 fade-up">
      <h2 className="text-[20px] md:text-2xl text-text font-medium tracking-[-0.01em]">
        {headline ?? copy.headline}
      </h2>
      <p className="mt-2 text-[15px] text-text-soft leading-relaxed max-w-prose">
        {subline ?? copy.subline}
      </p>

      {state === "ok" ? (
        <p className="mt-6 text-[14px] text-text-soft">
          you&apos;re on the list. we&apos;ll be in touch.
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mt-6 flex flex-col sm:flex-row gap-3"
          noValidate
        >
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="you@work.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={state === "loading"}
            className="flex-1 rounded-[12px] border border-border bg-bg px-4 py-3 text-[15px] text-text placeholder:text-text-muted outline-none focus:border-text-soft transition-colors"
          />
          <button
            type="submit"
            disabled={state === "loading" || !email.trim()}
            className="rounded-[12px] bg-text px-5 py-3 text-sm font-medium text-bg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-text-soft transition-colors"
          >
            {state === "loading" ? "saving…" : "notify me"}
          </button>
        </form>
      )}

      {state === "error" && (
        <p className="mt-3 text-[13px] text-severity-critical">
          something went wrong. try again in a minute.
        </p>
      )}
    </div>
  );
}
