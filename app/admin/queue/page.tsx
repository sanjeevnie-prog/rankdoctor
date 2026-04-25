"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";

import { PillNav } from "@/components/PillNav";

type PendingRow = {
  _id: string;
  url: string;
  keyword: string;
  created_at: number;
  top_finding_summary: string;
  share_token?: string;
};

export default function AdminQueuePage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const searchParams = useSearchParams();
  const key = searchParams.get("key");

  if (!key) {
    return (
      <div className="min-h-screen bg-bg text-text">
        <div className="mx-auto flex min-h-screen w-full max-w-[1200px] flex-col px-6 pt-6 pb-12 md:px-10 md:pt-8">
          <PillNav rightLabel="admin · queue" />
          <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col items-center justify-center text-center">
            <p className="text-[11px] uppercase tracking-[0.22em] text-severity-critical mb-3">
              Unauthorized
            </p>
            <h1 className="text-[36px] md:text-[44px] tracking-[-0.03em] leading-[1.05] text-text font-bold">
              This page needs a key.
            </h1>
            <p className="mt-4 text-[15px] text-text-soft">
              Append <code className="font-mono text-text">?key=...</code> to the URL.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <Queue adminKey={key} />;
}

function Queue({ adminKey }: { adminKey: string }) {
  const [rows, setRows] = useState<PendingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;

    async function load() {
      const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
      if (!convexUrl) {
        setError("NEXT_PUBLIC_CONVEX_URL is not set.");
        return;
      }
      try {
        const convex = new ConvexHttpClient(convexUrl);
        const { api } = (await import("@/convex/_generated/api")) as {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          api: any;
        };
        const result = (await convex.query(api.diagnoses.listPendingApproval, {
          key: adminKey,
        })) as PendingRow[] | null;
        if (!aborted) setRows(result ?? []);
      } catch (e) {
        if (!aborted) {
          setError(e instanceof Error ? e.message : "failed to load.");
        }
      }
    }

    load();
    return () => {
      aborted = true;
    };
  }, [adminKey]);

  async function approve(id: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, key: adminKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "approve failed");
      }
      setRows((prev) => (prev ? prev.filter((r) => r._id !== id) : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "approve failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="mx-auto flex min-h-screen w-full max-w-[1200px] flex-col px-6 pt-6 pb-12 md:px-10 md:pt-8">
        <PillNav rightLabel="admin · queue" />

        <div className="mx-auto w-full max-w-[820px] flex-1 mt-12 md:mt-16">
          <section>
            <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted mb-3">
              Admin
            </p>
            <h1 className="font-bold tracking-[-0.04em] leading-[1] text-[40px] md:text-[56px] text-text">
              Pending opt-ins.
            </h1>
            <p className="mt-4 text-[15px] text-text-soft">
              Submitter checked the box. Approve to publish to /examples.
            </p>
          </section>

          <div className="mt-10 space-y-3">
        {error && (
          <div className="rounded-[12px] border border-border bg-bg-card p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-severity-critical mb-2">
              Error
            </p>
            <p className="text-[14px] text-text-soft">{error}</p>
          </div>
        )}

        {rows === null && !error && (
          <p className="text-[14px] text-text-muted">Loading…</p>
        )}

        {rows !== null && rows.length === 0 && !error && (
          <p className="text-[14px] text-text-muted">Queue is empty.</p>
        )}

        {rows?.map((row) => (
          <article
            key={row._id}
            className="rounded-[12px] border border-border bg-bg-card p-5 md:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[15px] text-text truncate">{row.url}</p>
                <p className="mt-1 text-[13px] text-text-muted">
                  {row.keyword}
                  <span className="mx-2">·</span>
                  <span className="font-mono tabular-nums">
                    {new Date(row.created_at).toLocaleString()}
                  </span>
                </p>
                <p className="mt-3 text-[14px] leading-relaxed text-text-soft">
                  {row.top_finding_summary}
                </p>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                {row.share_token && (
                  <Link
                    href={`/d/${row.share_token}`}
                    target="_blank"
                    className="rounded-[12px] border border-border bg-bg px-3 py-2 text-[12px] text-text-soft hover:text-text hover:border-text-soft text-center"
                  >
                    View
                  </Link>
                )}
                <button
                  onClick={() => approve(row._id)}
                  disabled={busyId === row._id}
                  className="rounded-[12px] bg-text px-3 py-2 text-[12px] font-medium text-bg disabled:opacity-40 hover:bg-text-soft transition-colors"
                >
                  {busyId === row._id ? "Approving…" : "Approve"}
                </button>
              </div>
            </div>
            </article>
          ))}
          </div>
        </div>
      </div>
    </div>
  );
}
