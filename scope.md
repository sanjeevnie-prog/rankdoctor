# scope — SEO ranking drop diagnostic (path B-lite)

_user writes this, not the AI. questions get answered as we go._

## one-line pitch
**a doctor for your dropped rankings. paste URL + keyword. diagnosis in 30 seconds.**

## the user (concretely)
one of three:
- SEO freelancer
- SEO agency (managing multiple clients)
- head of SEO at a software company

trigger: their SEO ranking is crashing.
feeling: urgency — direct revenue hit.

## user journey 1 — first visit (reactive diagnosis)

### screen 1
hero header (doctor's-room tone — "things are going to be okay"). two input fields: URL + target keyword. one button: "diagnose."

### input
URL (required). target keyword (required). nothing else on screen 1.

### submit
user clicks "diagnose." loading state begins. tool fetches: current SERP position, page HTML, wayback snapshots, pagespeed, algo update timeline. claude synthesizes into diagnosis.

### processing
user sees loading state. expected: ~15-30 seconds. show progress cues (e.g., "fetching SERP..." / "checking page history..." / "cross-referencing algo updates...").

### output
diagnosis rendered as linear-style dark cards. one card per diagnosed cause, ranked top-to-bottom by severity.

**each card has:**
- severity pill (critical / high / medium) with color dot
- short headline (the cause, e.g., "meta description edited 5 days ago")
- paragraph explanation (plain english, 1-2 sentences)
- divider line
- "fix:" section — 1-2 line specific action
- optional: "confidence: 87%" badge

**top of output:**
- hero numeric: position drop (e.g., "3 → 14")
- "expected recovery" callout with muted accent color

### design system
- dark near-black background (`#0A0A0A`)
- white primary text
- gray secondary text
- muted accent colors (severity only — red for critical, amber for high, green for medium)
- geometric sans-serif type (likely geist or inter)
- rounded cards (12px corners)
- thin dividers, lots of whitespace
- no illustrations, no icons beyond severity dots

### post-diagnosis
- **share card preview (locked 2026-04-25)** — below the multi-card diagnosis, render a single-card summary (rank drop hero + site + keyword + top finding headline + brand mark). this is exactly what twitter / slack / imessage will show as the link preview. user sees what's about to be shared before they share it.
- **share button** — "tweet this diagnosis" opens twitter intent with prefilled text + link to `/d/{share_token}`. the OG/twitter-card image at that URL is the same single-card design as the on-screen preview (one source of truth — `app/d/[token]/opengraph-image.tsx` generates it on the fly).
- **opt-in to examples (locked 2026-04-25 — option B flow)** — checkbox shown AFTER the diagnosis renders, not before. user reads their actual diagnosis, then decides if they're happy to publish. ticking it fires a SECOND POST to `/api/diagnose-optin` with `{ share_token, optedIn: true }`. the initial `/api/diagnose` always sends `optIn: false`. default unchecked. reason: better consent + more opt-ins = richer examples bank for v2 funnel.
- **beta status** — small text under the cards: "{N}/250 free diagnoses used this weekend."

## user journey 2 — return visit (rate-limited)

each ip+cookie gets **5 diagnoses total** for the duration of the weekend beta (no time window — counter just keeps incrementing per ip_hash). on the 6th submit, form is replaced with "you've used your 5 free diagnoses. drop your email for v2 with multi-URL tracking + weekly monitoring." that email captures to the waitlist.

once total submissions hit 250 across all users, every visitor sees "saturday's beta is closed. drop your email for v2." regardless of ip.

## user journey 3 — browsing public examples

a public `/examples` page lists diagnoses that were (a) opted-in by the submitter at the time of diagnosis, and (b) manually approved by me. each entry shows: site URL + keyword + 2-3 line summary of the top finding. clicking → full diagnosis page at `/d/{share_token}`.

approval happens via a private admin URL only i can access (`/admin/queue?key=...`). unapproved opt-ins sit in a queue. nothing is public by default.

intent: serves as the case-study bank that shows the product works on real sites, drives word-of-mouth, and seeds v2 conversion when the paid monitoring tier launches.

## the three layers

### frontend
- next.js 16 app router (already scaffolded)
- tailwind v4 (already configured)
- single page with: hero header + form (URL + keyword + diagnose button) → loading state → diagnosis cards rendered
- dark mode only. no light/dark toggle.

### backend + db
- next.js api route `/api/diagnose` handles the core flow
- convex schema adds a `diagnoses` table (stores input + output for each run — per process doc: "store all incoming data")
- no cron, no background jobs (MVP is reactive only)

**diagnoses table fields:**
- url, keyword, diagnosis_json, created_at, serp_position_current, serp_position_inferred_previous (if available), page_text_normalized, wayback_text_diff, pagespeed_json, wayback_snapshot_count, algo_updates_in_window_json, raw_claude_response
- share_token (random string, used in `/d/{share_token}` public URL)
- opted_in_to_examples (boolean, default false — submitter checked the box)
- approved_for_public (boolean, default false — i approved via admin queue)
- ip_hash (sha256 of ip + cookie, used for per-user rate limit)

**meta table fields (single-row counter):**
- total_submissions (integer; cap is 250 for v1)

**rate limit + cap rules:**
- before insert: check total count of diagnoses where ip_hash matches; if ≥5, return "you've used your 5 free diagnoses" response
- before insert: check meta.total_submissions; if ≥250, return "beta closed" response
- on insert: atomically increment meta.total_submissions

### third-party
- serpapi (SERP position fetch)
- google pagespeed insights (core web vitals)
- wayback machine (historical page snapshots)
- claude API (diagnosis synthesis)

## out of scope (V1)
- slack webhook monitoring
- daily cron / background detection
- user accounts / auth
- payment / paywall
- multi-URL tracking / dashboard
- history of past diagnoses
- email alerts

## POC plan

**goal:** validate the core diagnostic brain in claude chat (not claude code) before writing a single line of code.

**setup:**
- open claude chat
- feed in a real dropped URL + keyword (user picks one they know about or one i pick from semrush's "rising/falling" pages)
- also feed in: current SERP competitors' URLs, wayback snapshot of the page from 30 days ago, pagespeed score, list of google algo updates in last 90 days
- ask claude to generate the diagnosis in the output shape we locked

**success criteria:**
- output identifies 3-5 causes with clear reasoning
- each cause has a specific fix tied to evidence
- output would read well to an SEO person (not robotic, not vague)
- confidence ratings feel calibrated (not all 90%+)

**if POC passes:** lock the prompt, proceed to build.
**if POC fails:** sharpen prompt until output is razor-sharp, or kill the idea.

## POC results (run on 2026-04-25)

ran 3 rounds inside claude code (not chat) using built-in web search + curl + wayback CDX:

| round | site | keyword | top finding |
|---|---|---|---|
| 1 | growthx.club | AI courses india | not in top 10; intent mismatch + march update timing + canonical/og:url bug |
| 2 | semrush.com | SEO/AEO/GEO | homepage doesn't compete for category-defining new terms; near-shipped a false "title empty" finding (caught) |
| 3 | serpstat.com | seo tool | not in top 10; canonical/og:url bug recurs; CDX showed content change 1 day before march spam update |

three failure modes surfaced → became the prompt's hardening rules (next section).

three recurring patterns surfaced (all 3 sites):
- page intent ≠ keyword intent on listicle-dominated SERPs (3/3)
- recent (≤90 days) google core update timing pressure (3/3)
- canonical/og:url mismatch in `<head>` (2/3)
- generic H1 not echoing target keyword (3/3)

## locked decisions

- **model:** Claude Sonnet 4.6 (`claude-sonnet-4-6`). Haiku 4.5 deferred — quality > $7/wk savings.
- **SERP source:** Anthropic `web_search` server tool (~$0.01/diagnosis). No SerpAPI / DataForSEO for v1.
- **drop framing:** path B — "doctor for your dropped rankings" hook + optional user-supplied "prior rank" form field. No automatic rank tracking in v1.
- **wayback API:** CDX is primary (`web.archive.org/cdx/search/cdx?...`). The `/wayback/available?` endpoint was unreliable in POC.
- **prompt caching:** required on system prompt (`cache_control: ephemeral`).
- **rate limit:** 5 diagnoses per ip_hash for the weekend beta (no time window — total count).
- **cap:** 250 total diagnoses. After 250: form replaced with email capture for v2.
- **anthropic spend cap:** $20 hard ceiling, set in console (~$1-5 expected, $20 worst case for viral).
- **demo source for waitlist page:** semrush.com — but block deferred until brain validates on a fresh case study.
- **opt-in flow (locked 2026-04-25):** option B — checkbox AFTER the diagnosis renders. second POST to `/api/diagnose-optin` flips `optedInToExamples` on the existing row. reason: user opts in once they see what they're publishing.
- **share-page data privacy (locked 2026-04-25):** option A — `getByShareToken` Convex query returns ONLY public fields (url, keyword, diagnosisJson, shareToken, optedInToExamples, approvedForPublic, createdAt). Private fields (ipHash, rawClaudeResponse, raw fetcher dumps) physically don't leave the database, so they can't leak via `/d/{token}` page source, dev tools, or future export bugs.
- **share card (locked 2026-04-25):** single-card summary, generated on the fly per diagnosis. one source of truth — same image is shown to the user on the result screen as a preview AND served as the OG/twitter-card preview when the URL is shared. file: `app/d/[token]/opengraph-image.tsx` (Next.js built-in ImageResponse, no extra deps). diagnosis output itself stays multi-card (severity ranked) per scope above — single-card is share surface only.
- **waitlist visual unity (locked 2026-04-25):** all three "drop your email" surfaces (`/waitlist` route, rate-limited inline, cap-reached inline) use the same `EmailCapture` component and visual style. backend already unifies them on the `waitlistV2` Convex table with a `source` field ("waitlist_page" | "rate_limited" | "cap_reached").

## hardening rules (must be in the locked system prompt)

three rules baked into `lib/prompts/diagnosis-system.ts`:

1. **re-read before claiming** — when citing HTML structure (e.g., "title is empty"), parse multi-line content carefully. round 2 near-shipped a false finding because a single-line regex missed content on the next line. use proper HTML parsing, not single-line greps.
2. **no fake drop magnitude** — if `priorRank` is null/undefined, do NOT generate "X → Y" hero. output `{ current_rank, history_available: false }`. never invent before/after numbers.
3. **graceful degradation per data source** — if any of the 5 fetchers errors or returns empty, the diagnosis explicitly notes the gap (e.g., "PageSpeed quota exhausted; CWV unmeasured this run"). do NOT hallucinate values for missing data.

## build plan — 4 parallel agents with strict file ownership

| agent | files owned |
|---|---|
| **frontend** | `app/page.tsx` (replaces ninety waitlist), `app/d/[token]/page.tsx`, `app/examples/page.tsx`, `app/admin/queue/page.tsx`, `components/*.tsx`, `app/globals.css` |
| **backend** | `convex/schema.ts` (extend), `convex/diagnoses.ts` (new), `app/api/diagnose/route.ts`, `app/api/admin/approve/route.ts`, `app/api/cap-status/route.ts`, `lib/types.ts` (DiagnosisJson source-of-truth), `.env.example` |
| **brain** | `lib/diagnose.ts`, `lib/fetchers/{page-html,wayback,pagespeed,algo-updates,serp}.ts`, `lib/prompts/diagnosis-system.ts`, `lib/anthropic-client.ts`, `scripts/test-brain.ts`, `package.json` (deps + scripts) |
| **waitlist** | `app/waitlist/page.tsx` only (NO demo block — deferred until brain validation) |

shared contracts:
- `lib/types.ts` — `DiagnosisJson` type. Backend creates; frontend + brain import. Backend owns; nobody else modifies.
- `lib/diagnose.ts` — `async function diagnose({url, keyword, priorRank?}): Promise<DiagnosisJson>`. Brain creates; backend imports and calls from `/api/diagnose`.
- convex queries: `getByShareToken`, `listApproved`, `listPendingApproval`, `getCapStatus`. Backend creates; frontend reads.

## current status snapshot (2026-04-25)

- ✅ scope.md, weekender.md, handbook all in place
- ✅ git repo initialized (`git log` → initial commit `48140f4`)
- ✅ POC run 3 times (rounds 1-3 above)
- ✅ all decisions locked (above)
- ✅ **4 build agents shipped** in isolated git worktrees (frontend, backend, brain, waitlist). Each branch sits in `.claude/worktrees/agent-*` ready to merge.
- ✅ cross-cutting decisions resolved (option A, option B, OG share card, waitlist unity, .gitignore fix, frontend lib helpers kept, font swap to geist kept)
- ⏳ integration: merging 4 worktrees onto main, applying option A + option B + OG card patches, running typecheck
- ⏳ 3 review subagents (per build-process memory) → fix findings → second review pass
- ⏳ user to provide: ANTHROPIC_API_KEY, PAGESPEED_API_KEY, ADMIN_KEY in `.env.local` (will be requested explicitly when needed — before `npm run brain` or local dev server)
- ⏳ round 4 brain validation: `npm run brain -- "<url>" "<keyword>"` against a fresh case study URL. user runs after integration + review passes.
- ⏳ demo block on `/waitlist`: deferred until round 4 passes
- ⏳ vercel deploy: deferred until round 4 passes
