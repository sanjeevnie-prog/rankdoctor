import type { DiagnosisJson } from "@/lib/types";

// On-screen share card preview. Shown above the "tweet this" button on the
// result screen and on /d/[token] so the user sees what their followers will see.
//
// Same visual as app/d/[token]/opengraph-image.tsx — when updating the layout,
// update both. (Cannot share JSX directly: ImageResponse is a different
// rendering pipeline that doesn't accept Tailwind classes.)
export function ShareCardPreview({ diagnosis }: { diagnosis: DiagnosisJson }) {
  const hostname = (() => {
    try {
      return new URL(diagnosis.url).hostname.replace(/^www\./, "");
    } catch {
      return diagnosis.url;
    }
  })();

  const rank = diagnosis.rank_info;
  const rankLine =
    rank.history_available && typeof rank.current_rank === "number"
      ? `rank dropped ${rank.prior_rank} → ${rank.current_rank}`
      : typeof rank.current_rank === "number"
        ? `currently ranking #${rank.current_rank}`
        : "ranking not in top 10";

  const topFindingHeadline = diagnosis.causes[0]?.headline ?? "diagnosis available";

  return (
    <div className="space-y-3">
      <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted">
        what your followers will see
      </p>
      {/* 1200x630 aspect ratio mini-preview. Same content + layout as the OG image. */}
      <div
        className="rounded-[12px] border border-border bg-bg-card overflow-hidden"
        style={{ aspectRatio: "1200 / 630" }}
      >
        <div className="flex h-full flex-col justify-between p-6 md:p-8">
          {/* top */}
          <div className="flex items-baseline justify-between">
            <span className="text-text font-semibold tracking-[-0.02em] text-base md:text-lg">
              rankdoctor
            </span>
            <span className="text-[10px] md:text-[11px] uppercase tracking-[0.22em] text-text-muted">
              diagnosis
            </span>
          </div>

          {/* middle: rank + site/keyword */}
          <div className="space-y-2 md:space-y-3">
            <div className="text-text font-semibold tracking-[-0.03em] leading-[1.05] text-2xl md:text-4xl lg:text-5xl">
              {rankLine}
            </div>
            <div className="flex items-baseline gap-2 text-[12px] md:text-[15px]">
              <span className="text-text">{hostname}</span>
              <span className="text-text-muted">·</span>
              <span className="text-text-soft">&ldquo;{diagnosis.keyword}&rdquo;</span>
            </div>
          </div>

          {/* bottom: top finding */}
          <div className="space-y-1.5">
            <div className="text-[9px] md:text-[10px] uppercase tracking-[0.22em] text-text-muted">
              top finding
            </div>
            <div className="text-text leading-snug text-[13px] md:text-[16px] line-clamp-2">
              {topFindingHeadline}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
