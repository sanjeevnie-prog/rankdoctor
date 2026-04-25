"use client";

import { useState, type FormEvent } from "react";

// Inlined form for the peach-themed /waitlist page. Visually distinct from
// the dark `EmailCapture` component used for rate-limited / cap-reached
// inline captures elsewhere — this surface is the one light surface.
// Same backend: POSTs to /api/waitlist-v2 with source: "waitlist_page".

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || state === "loading") return;
    setState("loading");
    try {
      const res = await fetch("/api/waitlist-v2", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source: "waitlist_page" }),
      });
      if (!res.ok) throw new Error("waitlist failed");
      setState("ok");
    } catch {
      setState("error");
    }
  }

  if (state === "ok") {
    return (
      <div className="rounded-full bg-bg-card px-5 py-4 text-[15px] text-text text-center">
        You&apos;re on the list. We&apos;ll page you when v2 is live.
      </div>
    );
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col sm:flex-row items-stretch gap-3"
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
          {state === "loading" ? "Booking…" : "Book an appointment →"}
        </button>
      </form>
      {state === "error" && (
        <p className="mt-3 text-[13px] text-severity-critical">
          Something hiccupped. Try once more?
        </p>
      )}
    </>
  );
}
