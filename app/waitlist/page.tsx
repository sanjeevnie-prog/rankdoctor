import Link from "next/link";

import { EmailCapture } from "@/components/EmailCapture";

// v2 waitlist landing — same EmailCapture component used by the rate-limited
// and cap-reached inline surfaces, so all three look identical and write to
// the same waitlistV2 Convex table (just with a different `source` tag).

export default function WaitlistPage() {
  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-1 flex-col px-5 pt-10 pb-20 md:px-8 md:pt-16">
      <header className="flex items-center justify-between">
        <Link
          href="/"
          className="text-sm font-medium tracking-[-0.01em] text-text"
        >
          rankdoctor
        </Link>
      </header>

      <section className="pt-12 md:pt-16">
        <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted mb-3">
          v2 — coming soon
        </p>
        <h1 className="text-[28px] md:text-[34px] leading-[1.1] tracking-[-0.02em] text-text font-medium">
          we&apos;ll watch your rankings.
        </h1>
        <p className="mt-3 max-w-prose text-[15px] md:text-base text-text-soft leading-relaxed">
          v2 is multi-URL tracking + weekly monitoring. drop your email — slack
          ping the day a ranking drops more than three positions.
        </p>
      </section>

      <section className="mt-10 mb-10">
        <h2 className="text-[11px] uppercase tracking-[0.22em] text-text-muted mb-4">
          what&apos;s coming in v2
        </h2>
        <ul className="space-y-3 text-[14px] md:text-[15px] text-text-soft">
          <li className="border-l border-border-soft pl-4">
            track up to 50 URLs across all your clients in one dashboard.
          </li>
          <li className="border-l border-border-soft pl-4">
            weekly automated diagnostics — no more pasting URLs every monday morning.
          </li>
          <li className="border-l border-border-soft pl-4">
            slack and email alerts the moment a ranking drops more than three positions.
          </li>
        </ul>
      </section>

      <EmailCapture variant="waitlist_page" />

      <footer className="mt-12 pt-8 border-t border-border-soft">
        <Link
          href="/"
          className="text-[13px] text-text-soft hover:text-text underline underline-offset-4 decoration-text-muted/40"
        >
          ← back to the diagnostic
        </Link>
      </footer>
    </div>
  );
}
