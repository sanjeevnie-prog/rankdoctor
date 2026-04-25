import Link from "next/link";

import { PillNav } from "@/components/PillNav";
import { getConvex } from "@/lib/convexServer";

export const dynamic = "force-dynamic";

type ApprovedRow = {
  share_token: string;
  url: string;
  keyword: string;
  top_finding_summary: string;
};

async function fetchApproved(): Promise<ApprovedRow[]> {
  try {
    const convex = getConvex();
    const { api } = (await import("@/convex/_generated/api")) as {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      api: any;
    };
    const rows = (await convex.query(api.diagnoses.listApproved, {})) as
      | ApprovedRow[]
      | null;
    return rows ?? [];
  } catch {
    return [];
  }
}

function tryHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default async function ExamplesPage() {
  const rows = await fetchApproved();

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="mx-auto flex min-h-screen w-full max-w-[1200px] flex-col px-6 pt-6 pb-12 md:px-10 md:pt-8">
        <PillNav />

        <div className="mx-auto w-full max-w-[820px] flex-1 mt-12 md:mt-16">
          <section>
            <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted mb-3">
              Examples
            </p>
            <h1 className="font-bold tracking-[-0.04em] leading-[1] text-[44px] md:text-[64px] lg:text-[80px] text-text">
              Real diagnoses.
              <br />
              <span className="text-text-soft">Real pages.</span>
            </h1>
            <p className="mt-6 max-w-prose text-[16px] md:text-[17px] leading-[1.5] text-text-soft">
              Each entry was opted in by the submitter and approved by us. Click any row
              to read the full diagnosis.
            </p>
          </section>

          <div className="mt-10">
        {rows.length === 0 ? (
          <div className="rounded-[12px] border border-border bg-bg-card p-6 md:p-8">
            <p className="text-[15px] text-text-soft leading-relaxed">
              No approved examples yet. Check back after the weekend beta.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li key={row.share_token}>
                <Link
                  href={`/d/${row.share_token}`}
                  className="block rounded-[12px] border border-border bg-bg-card p-5 md:p-6 hover:border-text-soft transition-colors"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-[15px] text-text truncate">
                      {tryHostname(row.url)}
                    </span>
                    <span className="text-[12px] text-text-muted truncate max-w-[40%]">
                      {row.keyword}
                    </span>
                  </div>
                  <p className="mt-3 text-[14px] leading-relaxed text-text-soft line-clamp-3">
                    {row.top_finding_summary}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

        </div>

        <footer className="mt-20 pt-8 border-t border-border-soft mx-auto w-full max-w-[820px] flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted">
            Rankdoctor · weekend beta
          </p>
          <Link
            href="/"
            className="text-[13px] text-text-soft hover:text-text underline-offset-4 hover:underline"
          >
            Run your own diagnosis →
          </Link>
        </footer>
      </div>
    </div>
  );
}
