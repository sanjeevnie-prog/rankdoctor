import Link from "next/link";

// Shared mobbin-style pill nav. Every public page renders this at the top so
// the design language stays unified. Pass `rightLabel` to surface a small
// status (cap counter on home, "admin · queue" on the admin page, etc).

export type PillNavProps = {
  rightLabel?: string;
};

export function PillNav({ rightLabel }: PillNavProps) {
  return (
    <nav className="mx-auto flex w-full max-w-[760px] items-center justify-between rounded-full bg-bg-card pl-5 pr-4 py-3 md:pl-6 md:pr-5">
      <Link
        href="/"
        className="text-[15px] font-semibold tracking-tight text-text"
      >
        rankdoctor
      </Link>
      <div className="flex items-center gap-5 md:gap-7 text-[14px] text-text-soft">
        <Link href="/examples" className="hover:text-text transition-colors">
          Examples
        </Link>
        <Link
          href="/waitlist"
          className="font-medium hover:text-text transition-colors"
        >
          v2
        </Link>
        {rightLabel && (
          <span className="text-text-muted tabular-nums text-[12px] md:text-[13px]">
            {rightLabel}
          </span>
        )}
      </div>
    </nav>
  );
}
