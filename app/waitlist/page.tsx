"use client";

import Link from "next/link";
import { useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "loading" || status === "success") return;

    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/waitlist-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "waitlist_page" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };

      if (!res.ok || !data.ok) {
        setStatus("error");
        setErrorMessage(data.message ?? "something went wrong. try again?");
        return;
      }

      setStatus("success");
      setEmail("");
    } catch {
      setStatus("error");
      setErrorMessage("network hiccup. try once more.");
    }
  }

  const isSubmitting = status === "loading";
  const isDone = status === "success";

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white antialiased">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-16 sm:py-24">
        {/* hero */}
        <header className="mb-12">
          <p className="mb-4 text-xs uppercase tracking-[0.2em] text-neutral-500">
            v2 — coming soon
          </p>
          <h1 className="text-3xl font-medium leading-tight tracking-tight text-white sm:text-4xl">
            weekly monitoring for your top 10 rankings.
          </h1>
          <p className="mt-3 text-base text-neutral-400 sm:text-lg">
            we&apos;ll watch the rankings. you&apos;ll get a slack ping the day
            they drop.
          </p>
        </header>

        {/* what's coming */}
        <section className="mb-10">
          <h2 className="mb-4 text-sm uppercase tracking-[0.16em] text-neutral-500">
            what&apos;s coming in v2
          </h2>
          <ul className="space-y-3 text-sm text-neutral-300 sm:text-base">
            <li className="border-l border-neutral-800 pl-4">
              track up to 50 URLs across all your clients in one dashboard.
            </li>
            <li className="border-l border-neutral-800 pl-4">
              weekly automated diagnostics — no more pasting URLs every monday
              morning.
            </li>
            <li className="border-l border-neutral-800 pl-4">
              slack and email alerts the moment a ranking drops more than
              three positions.
            </li>
          </ul>
        </section>

        {/* email form */}
        <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-5 sm:p-6">
          {isDone ? (
            <div role="status" className="text-sm text-neutral-300">
              you&apos;re in. we&apos;ll email when v2 ships.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <label htmlFor="email" className="sr-only">
                email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@work.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-lg border border-neutral-800 bg-black px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-lg bg-white px-4 py-3 text-sm font-medium text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "saving..." : "save my spot"}
              </button>
              {status === "error" && (
                <p
                  role="alert"
                  className="text-xs text-red-400"
                >
                  {errorMessage}
                </p>
              )}
            </form>
          )}
        </section>

        {/* bottom link */}
        <footer className="mt-10">
          <Link
            href="/"
            className="text-sm text-neutral-500 transition-colors hover:text-neutral-300"
          >
            ← back to the diagnostic
          </Link>
        </footer>
      </div>
    </main>
  );
}
