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
- **share button** — "tweet this diagnosis" opens twitter intent with prefilled text + link to a public diagnosis page at `/d/{share_token}`.
- **opt-in to examples** — small checkbox above the share button: "ok to feature this in our public examples list (i'll be credited as the submitter)." default unchecked.
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
