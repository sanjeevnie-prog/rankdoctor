# weekender.md

## track
revenue — wants to ship a product that can actually sell, bring in users, solve a real problem.

## idea
**seo ranking drop diagnostic — MVP (reactive only).** user pastes URL + keyword. gets diagnosis. that's it. no monitoring, no webhook, no payment in V1.

V2+ (later): slack webhook monitoring, paywall, multi-URL tracking.

real goal: **learning** (scoping, system design, reviewing code, shipping real product). empathy gap with end user accepted.

build mode: review + explain at every step. i brief agents → code returns → i walk user through what was built before moving on.

**deadline: MVP done by 11am sat 25 apr. submission sat 8pm.**

## first user
_tbd_

## stage
idea locked fri 24 apr evening. not yet scoped. previous waitlist (ninety) is live but being deprioritized — may reuse the stack (next.js + convex + vercel).

## live URL
- https://90-second-notes.vercel.app — waitlist for "ninety" (podcast show notes in 90 sec)

## metrics
_tbd — no known signups yet; tracking needs to be checked_

## daily log

### wed 22 apr
- no entry captured

### thu 23 apr
- shipped waitlist landing page for ninety at https://90-second-notes.vercel.app
- stack wired: next.js + tailwind + convex + vercel + resend (resend disabled for now)
- convex prod deployment live (striped-rat-529)
- waitlist form tested end-to-end, one test submission in convex

### fri 24 apr
- spent the day re-opening the idea question — explored ~60 candidate ideas
- built a tight filter set: paste-and-go, no creative writing, not chatgpt-able, real moat, india-viable
- shortlist narrowed to: seo ranking drop diagnostic, conversion tracking health check
- flagged blocker: no personal ga4 / ad-account access for validation
- still not locked on what to build between now and sat 8pm
- **important clarification:** real goal for the weekend is **learning** (engineering process, code organization, product thinking for new domains), not revenue. reason for pushing back against ninety: feels too familiar (already built a voice-transcription agent before); wouldn't teach anything new.
- **locked idea: seo ranking drop diagnostic.** paused before building. will restart with a fresh prompt.
