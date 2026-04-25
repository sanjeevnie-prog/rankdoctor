import Link from "next/link";

import { PillNav } from "@/components/PillNav";
import { WaitlistForm } from "./waitlist-form";

// Mobbin-inspired light theme. Uses the shared PillNav so the design
// language matches every other page.

export default function WaitlistPage() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="mx-auto flex min-h-screen w-full max-w-[1200px] flex-col px-6 pt-6 pb-12 md:px-10 md:pt-8">
        <PillNav />

        {/* hero — same vertical rhythm + headline scale as the homepage,
            so both pages feel like the same product. */}
        <section className="flex flex-1 flex-col items-center justify-center pt-6 pb-8 text-center md:pt-8 md:pb-10">
          <p className="mb-4 text-[12px] md:text-[13px] font-medium uppercase tracking-[0.18em] text-text-muted">
            v2 — coming soon
          </p>

          <h1 className="font-bold tracking-[-0.045em] leading-[0.95] text-text text-[40px] sm:text-[56px] md:text-[72px] lg:text-[88px] max-w-[14ch] text-balance">
            We&apos;ll page you when it&apos;s live.
          </h1>

          <p className="mt-5 max-w-[52ch] text-[15px] md:text-[17px] leading-[1.5] text-text-soft text-balance">
            v2 is multi-URL tracking and weekly monitoring. Drop your email — we&apos;ll
            Slack you the day a ranking drops more than three positions.
          </p>

          <div id="waitlist-form" className="mt-7 md:mt-8 w-full max-w-[640px]">
            <WaitlistForm />
          </div>

          <p className="mt-4 text-[12px] text-text-muted">
            No spam. One email when v2 opens.
          </p>
        </section>

        {/* what's coming — same below-fold treatment as homepage's "what we check" */}
        <section className="border-t border-border-soft pt-12 pb-12">
          <p className="mb-8 text-center text-[12px] font-medium uppercase tracking-[0.18em] text-text-muted">
            What&apos;s coming in v2
          </p>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6 max-w-[960px] mx-auto">
            <Feature
              n="01"
              title="Multi-URL tracking"
              body="Track up to 50 URLs across all your clients in one dashboard."
            />
            <Feature
              n="02"
              title="Weekly diagnostics"
              body="No more pasting URLs every Monday morning. The brain runs on schedule."
            />
            <Feature
              n="03"
              title="Drop alerts"
              body="Slack and email the moment a ranking drops more than three positions."
            />
          </div>
        </section>

        {/* footer */}
        <footer className="mt-auto pt-10 flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between text-[13px] text-text-muted">
          <span>Rankdoctor — weekend beta.</span>
          <Link
            href="/"
            className="hover:text-text underline-offset-4 hover:underline"
          >
            ← Back to the diagnostic
          </Link>
        </footer>
      </div>
    </div>
  );
}

function Feature({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium tracking-[0.18em] text-text-muted">{n}</p>
      <h3 className="mt-2 text-[16px] md:text-[17px] font-semibold tracking-tight text-text">
        {title}
      </h3>
      <p className="mt-1.5 text-[13px] md:text-[14px] leading-[1.5] text-text-soft">{body}</p>
    </div>
  );
}
