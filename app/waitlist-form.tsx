"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email || status === "loading") return;

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Something went wrong. Try again?");
        return;
      }

      setStatus("success");
      setMessage("You're on the list. Check your inbox.");
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("Network hiccup. Try once more?");
    }
  }

  const isDone = status === "success";

  return (
    <form
      onSubmit={handleSubmit}
      className="group relative flex w-full max-w-xl flex-col gap-3 sm:flex-row"
      noValidate
    >
      <label htmlFor="email" className="sr-only">
        Email address
      </label>

      <div className="relative flex-1">
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@yourshow.fm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isDone || status === "loading"}
          className="w-full border-b-2 border-ink bg-transparent px-1 py-3 font-[family-name:var(--font-body)] text-lg text-ink placeholder:text-muted focus:border-accent focus:outline-none disabled:opacity-60"
        />
        <span className="pointer-events-none absolute -top-2 left-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-muted">
          email
        </span>
      </div>

      <button
        type="submit"
        disabled={isDone || status === "loading"}
        className="group/btn relative inline-flex items-center justify-center gap-2 border-2 border-ink bg-ink px-6 py-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.22em] text-accent-ink transition-colors hover:bg-accent hover:border-accent disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "loading"
          ? "Sending…"
          : isDone
            ? "On the list ✓"
            : "Join the waitlist"}
        {!isDone && status !== "loading" && (
          <span
            aria-hidden
            className="transition-transform group-hover/btn:translate-x-0.5"
          >
            →
          </span>
        )}
      </button>

      {message && (
        <p
          role={status === "error" ? "alert" : "status"}
          className={`absolute -bottom-7 left-0 font-[family-name:var(--font-mono)] text-[11px] tracking-wide ${
            status === "error" ? "text-accent" : "text-ink-soft"
          }`}
        >
          {message}
        </p>
      )}
    </form>
  );
}
