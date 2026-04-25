import type { DiagnosisJson } from "./types";

export const MOCK_DIAGNOSIS: DiagnosisJson = {
  url: "https://example.com/blog/best-running-shoes",
  keyword: "best running shoes",
  rank_info: {
    history_available: true,
    current_rank: 14,
    prior_rank: 3,
    drop: 11,
  },
  expected_recovery: "2-4 weeks if the meta and intro are restored and pagespeed is back under 2.5s LCP.",
  causes: [
    {
      severity: "critical",
      headline: "meta description rewritten 5 days ago",
      explanation:
        "the page's meta description was edited on apr 19. the new copy drops the primary keyword and reads like a generic category page. SERP CTR likely fell, which Google reads as a relevance signal.",
      fix: "restore the prior meta description (or rewrite to lead with 'best running shoes for' and a specific use case in the first 110 chars).",
      confidence: 0.88,
    },
    {
      severity: "high",
      headline: "h1 changed from product-led to category-led",
      explanation:
        "wayback shows the h1 used to be 'the best running shoes of 2026, tested over 400 miles.' it's now 'running shoes guide.' you lost the long-tail intent match and the freshness cue.",
      fix: "revert to a specific, dated, first-person h1. include the year and a credibility cue (miles tested, reviewers, etc).",
      confidence: 0.74,
    },
    {
      severity: "high",
      headline: "march core update overlap",
      explanation:
        "google rolled out a core update on mar 28 — your drop started apr 2. pages that lost ranking in this window were disproportionately product-recommendation content with thin first-person testing.",
      fix: "add original photos of you wearing/testing the shoes, plus a methodology section. core updates reward demonstrated experience.",
      confidence: 0.61,
    },
    {
      severity: "medium",
      headline: "LCP regressed from 2.1s to 4.3s",
      explanation:
        "pagespeed shows LCP doubled in the last 30 days, likely from a hero image swap that isn't using next/image or proper sizing.",
      fix: "set explicit width/height on the hero, serve as webp, and preload above-the-fold images.",
      confidence: 0.82,
    },
  ],
  data_gaps: [
    {
      source: "wayback",
      reason: "no wayback snapshot between mar 15 and apr 12, so we can't pinpoint exact date of h1 change.",
    },
  ],
  generated_at: Date.now(),
};
