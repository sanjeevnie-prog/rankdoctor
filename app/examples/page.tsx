import Link from "next/link";

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
    <div className="mx-auto flex w-full max-w-[820px] flex-1 flex-col px-5 pt-10 pb-20 md:px-8 md:pt-16">
      <header className="flex items-center justify-between">
        <Link
          href="/"
          className="text-sm font-medium tracking-[-0.01em] text-text"
        >
          rankdoctor
        </Link>
        <Link
          href="/"
          className="text-[13px] text-text-soft hover:text-text"
        >
          run a diagnosis
        </Link>
      </header>

      <section className="pt-12 md:pt-16">
        <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted mb-3">
          examples
        </p>
        <h1 className="text-[36px] md:text-[44px] leading-[1.05] tracking-[-0.02em] text-text font-medium">
          real diagnoses on real pages.
        </h1>
        <p className="mt-5 max-w-prose text-[16px] leading-relaxed text-text-soft">
          each entry was opted in by the submitter and approved by us. click any row
          to read the full diagnosis.
        </p>
      </section>

      <div className="mt-10">
        {rows.length === 0 ? (
          <div className="rounded-[12px] border border-border bg-bg-card p-6 md:p-8">
            <p className="text-[15px] text-text-soft leading-relaxed">
              no approved examples yet. check back after the weekend beta.
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

      <footer className="mt-20 pt-8 border-t border-border-soft">
        <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted">
          rankdoctor · weekend beta
        </p>
      </footer>
    </div>
  );
}
