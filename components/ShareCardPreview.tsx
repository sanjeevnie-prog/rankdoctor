import type { DiagnosisJson } from "@/lib/types";
import { deriveShareCardFields } from "@/lib/share-card";

// On-screen share card preview. Shown above the "tweet this" button on the
// result screen AND on /d/[token] (so anyone hitting the share link also
// sees the card framing). Same visual + same content as
// app/d/[token]/opengraph-image.tsx — both pull from deriveShareCardFields().
//
// JSX can't be shared directly between the two: ImageResponse uses inline
// styles, not Tailwind. The data derivation IS shared (lib/share-card.ts).
export function ShareCardPreview({ diagnosis }: { diagnosis: DiagnosisJson }) {
  const { hostname, keyword, rankLine, topFindingHeadline } =
    deriveShareCardFields(diagnosis);

  return (
    <div className="space-y-3">
      <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted">
        What your followers will see
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
              Diagnosis
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
              <span className="text-text-soft">&ldquo;{keyword}&rdquo;</span>
            </div>
          </div>

          {/* bottom: top finding */}
          <div className="space-y-1.5">
            <div className="text-[9px] md:text-[10px] uppercase tracking-[0.22em] text-text-muted">
              Top finding
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
