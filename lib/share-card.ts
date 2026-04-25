import type { DiagnosisJson } from "./types";

// Single source of truth for the share card's content.
// Used by:
//   - components/ShareCardPreview.tsx (on-screen preview, Tailwind)
//   - app/d/[token]/opengraph-image.tsx (OG/twitter card PNG, inline styles)
// If you change the derivation here, both surfaces update at once.

export type ShareCardFields = {
  hostname: string;
  keyword: string;
  rankLine: string;
  topFindingHeadline: string;
};

export function deriveShareCardFields(diagnosis: DiagnosisJson): ShareCardFields {
  let hostname = diagnosis.url;
  try {
    hostname = new URL(diagnosis.url).hostname.replace(/^www\./, "");
  } catch {
    /* keep raw url */
  }

  const rank = diagnosis.rank_info;
  const rankLine =
    rank.history_available && typeof rank.current_rank === "number"
      ? `rank dropped ${rank.prior_rank} → ${rank.current_rank}`
      : typeof rank.current_rank === "number"
        ? `currently ranking #${rank.current_rank}`
        : "ranking not in top 10";

  const topFindingHeadline =
    diagnosis.causes[0]?.headline ?? "diagnosis available";

  return {
    hostname,
    keyword: diagnosis.keyword,
    rankLine,
    topFindingHeadline,
  };
}
