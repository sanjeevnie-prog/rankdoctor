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
    headline: "You've used your 5 free diagnoses.",
    subline:
      "Drop your email for v2 — multi-URL tracking and weekly monitoring. We'll email you when it opens.",
  },
  cap_reached: {
    headline: "Saturday's beta is closed.",
    subline:
      "We hit the 250-diagnosis weekend cap. Drop your email for v2 with multi-URL tracking and weekly monitoring.",
  },
  waitlist_page: {
    headline: "Weekly monitoring for your top 10 rankings.",
    subline:
      "We'll watch the rankings. You'll get a Slack ping the day they drop. Drop your email — we'll be in touch when v2 opens.",
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
          You&apos;re on the list. We&apos;ll be in touch.
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
            className="flex-1 rounded-full border border-border bg-bg px-5 py-3.5 text-[15px] text-text placeholder:text-text-muted outline-none focus:border-text transition-colors"
          />
          <button
            type="submit"
            disabled={state === "loading" || !email.trim()}
            className="w-full sm:w-auto rounded-full px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_6px_18px_-6px_rgba(239,68,68,0.55)] active:translate-y-[1px] transition-all bg-[#EF4444] hover:bg-[#DC2626] hover:shadow-[0_8px_22px_-6px_rgba(239,68,68,0.7)] disabled:bg-[#FCA5A5] disabled:shadow-none disabled:cursor-not-allowed"
          >
            {state === "loading" ? "Saving…" : "Notify me →"}
          </button>
        </form>
      )}

      {state === "error" && (
        <p className="mt-3 text-[13px] text-severity-critical">
          Something went wrong. Try again in a minute.
        </p>
      )}
    </div>
  );
}
