import Link from "next/link";
import { notFound } from "next/navigation";

import { DiagnosisOutput } from "@/components/DiagnosisOutput";
import { getConvex } from "@/lib/convexServer";
import type { DiagnosisJson } from "@/lib/types";

// dynamic, since the diagnosis can be created at runtime.
export const dynamic = "force-dynamic";

type DiagnosisRow = DiagnosisJson & { share_token: string };

async function fetchDiagnosis(token: string): Promise<DiagnosisRow | null> {
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
    })) as DiagnosisRow | null;
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
    <div className="mx-auto flex w-full max-w-[820px] flex-1 flex-col px-5 pt-10 pb-20 md:px-8 md:pt-16">
      <header className="flex items-center justify-between">
        <Link
          href="/"
          className="text-sm font-medium tracking-[-0.01em] text-text"
        >
          rankdoctor
        </Link>
        <Link
          href="/examples"
          className="text-[13px] text-text-soft hover:text-text"
        >
          examples
        </Link>
      </header>

      <section className="pt-12 md:pt-16">
        <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted mb-3">
          shared diagnosis
        </p>
        <h1 className="text-[28px] md:text-[34px] leading-[1.1] tracking-[-0.02em] text-text font-medium">
          why this page dropped.
        </h1>
      </section>

      <div className="mt-10">
        <DiagnosisOutput diagnosis={diagnosis} />
      </div>

      <footer className="mt-16 pt-8 border-t border-border-soft">
        <Link
          href="/"
          className="text-[13px] text-text-soft hover:text-text underline underline-offset-4 decoration-text-muted/40"
        >
          run your own diagnosis →
        </Link>
      </footer>
    </div>
  );
}
