// Google PageSpeed Insights v5 — mobile, performance category.
// On 429/quota: returns the EXACT reason string the system prompt expects,
// so the data_gap row has the user-facing copy ready.
//
// Pulls BOTH lab data (Lighthouse simulation) AND CrUX field data (real
// chrome users in the last 28 days). Field data is what Google's Page
// Experience ranking signal uses; lab data is a worst-case proxy. The
// brain's system prompt is told to prefer field data for ranking diagnosis
// when both are available.

// Google's PSI API frequently takes 40-60s end-to-end (it runs a real
// Lighthouse audit server-side). 30s was too aggressive — bumped to 90s
// after seeing repeated timeouts on real sites in round 4 testing.
const FETCH_TIMEOUT_MS = 90_000;

export type CwvCategory = "FAST" | "AVERAGE" | "SLOW";

export type CwvMetric = {
  /** preferred value for ranking diagnosis: field if available, else lab */
  value: number | null;
  /** which source the preferred value came from */
  source: "field" | "lab" | null;
  /** CrUX p75 from real users (last 28 days) */
  fieldValue: number | null;
  /** CrUX category bucket: FAST / AVERAGE / SLOW */
  fieldCategory: CwvCategory | null;
  /** Lighthouse simulation value (worst-case mobile profile) */
  labValue: number | null;
};

export type PagespeedData = {
  lcp: CwvMetric;
  cls: CwvMetric;
  inp: CwvMetric;
  performanceScore: number | null; // lab-only; no CrUX equivalent
  cruxAvailable: boolean;
  raw: unknown;
};

export type PagespeedResult =
  | { ok: true; data: PagespeedData }
  | { ok: false; reason: string };

export async function fetchPagespeed(url: string): Promise<PagespeedResult> {
  const apiKey = process.env.PAGESPEED_API_KEY ?? "";
  if (apiKey.trim() === "") {
    return {
      ok: false,
      reason: "PAGESPEED_API_KEY missing; CWV unmeasured this run",
    };
  }

  const endpoint =
    `https://www.googleapis.com/pagespeedonline/v5/runPagespeed` +
    `?url=${encodeURIComponent(url)}&strategy=mobile&category=performance&key=${encodeURIComponent(apiKey)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(endpoint, { signal: controller.signal });

    if (res.status === 429) {
      return {
        ok: false,
        reason: "PageSpeed quota exhausted; CWV unmeasured this run",
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        reason: `PageSpeed returned HTTP ${res.status}; CWV unmeasured this run`,
      };
    }

    const json = (await res.json()) as PsiResponse;

    // Lab data — Lighthouse simulation
    const lhr = json.lighthouseResult;
    const audits = lhr?.audits ?? {};
    const labLcp = numericValue(audits["largest-contentful-paint"]);
    const labCls = numericValue(audits["cumulative-layout-shift"]);
    const labInp = numericValue(audits["interaction-to-next-paint"]);
    const score =
      typeof lhr?.categories?.performance?.score === "number"
        ? Math.round(lhr.categories.performance.score * 100)
        : null;

    // Field data — CrUX p75 over last 28 days. Prefer URL-specific over
    // origin-aggregated when both exist.
    const urlMetrics = json.loadingExperience?.metrics ?? {};
    const originMetrics = json.originLoadingExperience?.metrics ?? {};
    const lcpField = readField(urlMetrics, originMetrics, "LARGEST_CONTENTFUL_PAINT_MS");
    const clsField = readField(urlMetrics, originMetrics, "CUMULATIVE_LAYOUT_SHIFT_SCORE", true);
    const inpField = readField(urlMetrics, originMetrics, "INTERACTION_TO_NEXT_PAINT");

    const cruxAvailable =
      lcpField.value !== null || clsField.value !== null || inpField.value !== null;

    return {
      ok: true,
      data: {
        lcp: composeMetric(lcpField, labLcp),
        cls: composeMetric(clsField, labCls),
        inp: composeMetric(inpField, labInp),
        performanceScore: score,
        cruxAvailable,
        raw: json,
      },
    };
  } catch (err) {
    const reason =
      err instanceof Error
        ? err.name === "AbortError"
          ? "PageSpeed timed out; CWV unmeasured this run"
          : `PageSpeed failed: ${err.message}; CWV unmeasured this run`
        : "PageSpeed failed; CWV unmeasured this run";
    return { ok: false, reason };
  } finally {
    clearTimeout(timer);
  }
}

type PsiAudit = { numericValue?: number };
type PsiFieldMetric = {
  percentile?: number;
  category?: string;
};
type PsiLoadingExperience = {
  metrics?: Record<string, PsiFieldMetric>;
};
type PsiResponse = {
  lighthouseResult?: {
    audits?: Record<string, PsiAudit>;
    categories?: { performance?: { score?: number } };
  };
  loadingExperience?: PsiLoadingExperience;
  originLoadingExperience?: PsiLoadingExperience;
};

function numericValue(audit: PsiAudit | undefined): number | null {
  if (!audit || typeof audit.numericValue !== "number") return null;
  return audit.numericValue;
}

// Read a CrUX metric from URL-specific bucket first, fall back to origin.
// CLS is reported as integer percentile (e.g. 15 = 0.15), so divide.
function readField(
  urlMetrics: Record<string, PsiFieldMetric>,
  originMetrics: Record<string, PsiFieldMetric>,
  key: string,
  isCls = false,
): { value: number | null; category: CwvCategory | null } {
  const m = urlMetrics[key] ?? originMetrics[key];
  if (!m || typeof m.percentile !== "number") return { value: null, category: null };
  const value = isCls ? m.percentile / 100 : m.percentile;
  const validCats: CwvCategory[] = ["FAST", "AVERAGE", "SLOW"];
  const category = validCats.includes(m.category as CwvCategory)
    ? (m.category as CwvCategory)
    : null;
  return { value, category };
}

function composeMetric(
  field: { value: number | null; category: CwvCategory | null },
  labValue: number | null,
): CwvMetric {
  // Prefer real-user (field) data when available — that's what Google's
  // ranking signal actually uses. Lab is a fallback / worst-case.
  if (field.value !== null) {
    return {
      value: field.value,
      source: "field",
      fieldValue: field.value,
      fieldCategory: field.category,
      labValue,
    };
  }
  if (labValue !== null) {
    return {
      value: labValue,
      source: "lab",
      fieldValue: null,
      fieldCategory: null,
      labValue,
    };
  }
  return {
    value: null,
    source: null,
    fieldValue: null,
    fieldCategory: null,
    labValue: null,
  };
}
