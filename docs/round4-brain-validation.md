# Round 4 brain validation — 10 case-study runs

Snapshot of brain output across 10 real URLs run 2026-04-25 to 2026-04-26.
Validates the orchestrator works end-to-end; surfaces failures that drove
pass-3 fixes (timeouts, validator, field-data preference).

> Point-in-time, not live state. Code has moved on since this was written —
> use `git log` for the canonical timeline of fixes.

## context

Round 4 of the build process per `feedback_build_process.md` — the validation gate AFTER the parallel build agents and 2 review passes finished. Goal: confirm the brain produces razor-sharp diagnoses on real URLs, surface bugs to fix in pass-3.

All 10 cases run via `npm run brain -- "<url>" "<keyword>"` against Anthropic + Convex prod (striped-rat-529). Outputs in `tmp/brain-{ms}.json` files in the repo (ephemeral; gitignored).

## summary table

| # | URL | keyword | verdict | what brain caught | what failed |
|---|---|---|---|---|---|
| 1 | ahrefs.com/blog/seo-statistics | SEO stats | ✅ PASS | year mismatch (title 2024, meta 2023), 24-mo staleness, mobile LCP 9.5s, wayback diff (-300 words, -5 linking domains) | none |
| 2 | woocommerce.com | WooCommerce plugin | ❌ FAIL (expected) | current issues: title intent mismatch, self-cannibalization with /woocommerce/ | couldn't see 2023 historical domain migration (out of data window) |
| 3 | laurajawad.com | pregnancy personal trainer | ⚠️ PARTIAL | thin E-E-A-T pattern correctly identified | attributed to Mar 2026 core update instead of original Sept 2023 HCU (not in our 90-day algo list) |
| 4 | link-assistant.com | SEO software | ✅ PASS | mobile LCP 3.26s in "Needs Improvement" zone — same pattern as expected May 2022 CWV regression | none |
| 5 | mouthshut.com | product reviews India | ⚠️ PARTIAL | caught Angular template `{{vars}}` rendering as raw text in HTML (legit catch) | pagespeed timed out (30s); brain blind to CWV |
| 6 | blog.hubspot.com | how to write a cover letter | ✅ PASS | meta-diagnosis: "this is the blog homepage, wrong URL for a specific informational query." refused to invent findings. | none |
| 7 | indiamart.com/proddetail | wholesale suppliers India | ✅ PASS (better than hypothesis) | content/intent mismatch — page is generic "Latest Products" dump, no relevance to keyword. confirmed via SERP that homepage ranks #1, /proddetail is absent. | hypothesis was INP issue but brain found the deeper structural problem (wrong URL strategy entirely) |
| 8 | datarecovee.com/how-to-clear-cache-on-windows-10 | how to clear cache Windows 10 | ✅ PASS (sharpest run) | typo in Microsoft command (`WSResest.exe` vs `wsreset.exe`), title/body mismatch (3 steps vs 5 methods), CLS 0.131, missing competitor cache types | none |
| 9 | growthx.club | learn AI | ✅ PASS | og:url pointing to /about while canonical is `/`, recent rewrite removed "unfair advantage" framing, mobile LCP 10s lab / 2.7s field — wayback came through 60s timeout fix paid off | initial run reported lab LCP severity (10s) before field-preference fix; corrected after pass |
| 10 | woocommerce.com/products/woocommerce-checkout-add-ons | WooCommerce checkout plugin | ✅ PASS | mobile LCP 8.6s, intent mismatch (title says "Add-Ons", keyword is "checkout plugin"), only 14 reviews + 9K installs as social-proof signal | none |

7 PASS, 2 PARTIAL, 1 FAIL (expected fail — historical event out of data window).

## what these tests proved about the brain

- **specific findings, not vague generalities.** every PASS run identified concrete issues with evidence (typos, year strings, exact LCP ms, specific competitor names from live SERP).
- **honest about data gaps.** when wayback or pagespeed failed, brain explicitly flagged it in `data_gaps` instead of inventing values.
- **pattern matching > algorithm-name knowledge.** case 3 (laurajawad) couldn't cite the Sept 2023 HCU specifically, but identified the SAME class of issue (thin E-E-A-T) that update penalizes.
- **refused to confabulate when given wrong inputs.** case 6 (blog.hubspot.com homepage for an article keyword) returned "wrong URL" instead of fake-but-confident findings.
- **caught a literal typo in a Microsoft command** (case 8). that's senior-editor-level reading, not just SEO checklist-running.

## what failed → drove pass-3 fixes

| failure mode | fix shipped |
|---|---|
| pagespeed 30s timeout (cases 5, 6, 7) | bumped to 90s |
| wayback 15s timeout (cases 1, 2, 3, 5, 8) | bumped to 60s |
| validator rejected `drop: null` when `current_rank: null` (case 1, real ahrefs run) | relaxed validator to allow null when current unknown |
| brain reported lab LCP severity over CrUX field data (case 9 first run, growthx) | added field-data preference to system prompt + fetcher returns both |
| `serpPositionCurrent` declared but never populated | dropped from schema |

## what testing taught us about VALIDATION methodology

- **ground-truth-by-insider-knowledge** is the strongest validation (case 9 growthx — user could verify findings against real GrowthX SEO history).
- **historical cases (>1 year old) aren't fair tests** — brain only sees last 90-365 days. don't waste time grading these against expected historical causes (case 2 woo migration, case 3 laurajawad HCU). use them ONLY to test current-state diagnostic on those still-in-distress sites.
- **pre-check the URL with Google's PageSpeed** before testing CWV-related expected diagnoses. case 2 indiamart was a false test because real-user CrUX showed INP fast even though lab was poor.
- **fact-checker pattern is the strongest validation mode** — give brain a URL + your hypotheses about what's wrong, let brain confirm/refute against its data sources.

## what's NOT in this file (intentionally)

- raw JSON outputs — those are in `tmp/brain-{ms}.json` files in the repo, gitignored, ephemeral
- conversational debugging transcripts — in chat history, not load-bearing
- specific timestamps of when each test ran — irrelevant for reuse
