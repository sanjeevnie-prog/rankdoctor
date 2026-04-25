// Google PageSpeed Insights v5 — mobile, performance category.
// On 429/quota: returns the EXACT reason string the system prompt expects,
// so the data_gap row has the user-facing copy ready.

const FETCH_TIMEOUT_MS = 30_000;

export type PagespeedData = {
  lcp: number | null; // ms (largest contentful paint)
  cls: number | null; // unitless
  inp: number | null; // ms (interaction to next paint)
  performanceScore: number | null; // 0-100
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
    const lhr = json.lighthouseResult;
    const audits = lhr?.audits ?? {};
    const lcp = numericValue(audits["largest-contentful-paint"]);
    const cls = numericValue(audits["cumulative-layout-shift"]);
    const inp = numericValue(audits["interaction-to-next-paint"]);
    const score =
      typeof lhr?.categories?.performance?.score === "number"
        ? Math.round(lhr.categories.performance.score * 100)
        : null;

    return {
      ok: true,
      data: { lcp, cls, inp, performanceScore: score, raw: json },
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
type PsiResponse = {
  lighthouseResult?: {
    audits?: Record<string, PsiAudit>;
    categories?: { performance?: { score?: number } };
  };
};

function numericValue(audit: PsiAudit | undefined): number | null {
  if (!audit || typeof audit.numericValue !== "number") return null;
  return audit.numericValue;
}
