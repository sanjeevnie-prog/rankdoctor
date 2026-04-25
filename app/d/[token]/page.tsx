import Link from "next/link";
import { notFound } from "next/navigation";

import { DiagnosisOutput } from "@/components/DiagnosisOutput";
import { ShareCardPreview } from "@/components/ShareCardPreview";
import { PillNav } from "@/components/PillNav";
import { getConvex } from "@/lib/convexServer";
import type { PublicDiagnosis } from "@/lib/types";

// dynamic, since the diagnosis can be created at runtime.
export const dynamic = "force-dynamic";

async function fetchDiagnosis(token: string): Promise<PublicDiagnosis | null> {
  try {
    const convex = getConvex();
    // backend agent owns api.diagnoses.getByShareToken; the generated `api`
    // types don't include it yet, so we route around the typegen.
    const { api } = (await import("@/convex/_generated/api")) as {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      api: any;
    };
    const result = (await convex.query(api.diagnoses.getByShareToken, {
      token,
    })) as PublicDiagnosis | null;
    return result ?? null;
  } catch {
    return null;
  }
}

export default async function DiagnosisPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const diagnosis = await fetchDiagnosis(token);

  if (!diagnosis) notFound();

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="mx-auto flex min-h-screen w-full max-w-[1200px] flex-col px-6 pt-6 pb-12 md:px-10 md:pt-8">
        <PillNav />

        <div className="mx-auto w-full max-w-[820px] flex-1 mt-12 md:mt-16">
          <section>
            <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted mb-3">
              Shared diagnosis
            </p>
            <h1 className="font-bold tracking-[-0.04em] leading-[1] text-[40px] md:text-[56px] text-text">
              Why this page dropped.
            </h1>
          </section>

          <div className="mt-10">
            <DiagnosisOutput diagnosis={diagnosis} />
          </div>

          {/* Same share card the submitter saw before tweeting — gives this page
              a consistent framing for visitors who landed via the link. */}
          <div className="mt-10">
            <ShareCardPreview diagnosis={diagnosis} />
          </div>

          <footer className="mt-16 pt-8 border-t border-border-soft">
            <Link
              href="/"
              className="text-[13px] text-text-soft hover:text-text underline underline-offset-4 decoration-text-muted/40"
            >
              Run your own diagnosis →
            </Link>
          </footer>
        </div>
      </div>
    </div>
  );
}
