# Ninety — waitlist landing page

Editorial landing page for a "podcast show notes in 90 seconds" product.
**Next.js 16 + Tailwind v4 + Convex (storage) + Resend (email) → Vercel.**

Live: https://90-second-notes.vercel.app

## What's where

- `app/page.tsx` — landing page (server component)
- `app/waitlist-form.tsx` — email form (client component)
- `app/api/waitlist/route.ts` — POST handler: validates → Convex mutation → Resend email
- `convex/schema.ts` — `waitlist` table schema
- `convex/waitlist.ts` — `add`, `count`, `list` mutations/queries

## One-time setup

### 1. Convex (waitlist storage)

```bash
npx convex dev
```

First run opens a browser to log in, asks you to name the deployment, and writes `NEXT_PUBLIC_CONVEX_URL` + `CONVEX_DEPLOYMENT` into `.env.local` for you. It also pushes `schema.ts` and `waitlist.ts` to the Convex cloud. Leave it running during local dev — it watches the `convex/` folder and hot-reloads changes.

Once it's running, view your emails at:
```
https://dashboard.convex.dev  →  your project  →  Data  →  waitlist
```

### 2. Resend (welcome email)

1. Sign up at https://resend.com (free tier fine)
2. **API Keys → Create** — copy the key
3. Fill `RESEND_API_KEY` in `.env.local`

For production you'll also want to verify a domain (**Domains → Add**) and set `RESEND_FROM="Ninety <hello@yourdomain.com>"`.

### 3. Local env

```bash
cp .env.example .env.local
# npx convex dev will fill in the Convex vars
# add RESEND_API_KEY manually
```

## Run locally

```bash
# terminal 1
npx convex dev

# terminal 2
npm run dev
```

Visit http://localhost:3000, sign up, and the email should land in your Convex `waitlist` table and in your inbox.

## Deploy to Vercel

Already deployed at https://90-second-notes.vercel.app. To push updates:

```bash
vercel --prod
```

### Production env vars

Run once after `npx convex deploy --prod` gives you a production Convex URL:

```bash
vercel env add NEXT_PUBLIC_CONVEX_URL production
vercel env add CONVEX_DEPLOYMENT production       # optional, for Convex deploy hooks
vercel env add RESEND_API_KEY production
vercel env add RESEND_FROM production
vercel env add NOTIFICATION_EMAIL production
vercel --prod
```

## API contract

`POST /api/waitlist` with `{ "email": "..." }`:

| Response | Meaning |
|---|---|
| `200 { ok: true, emailSent: true }` | New signup, stored in Convex, welcome sent |
| `200 { ok: true, emailSent: false, note }` | Stored but email skipped (Resend not configured) |
| `200 { ok: true, alreadySubscribed: true }` | Email already in the list |
| `400 { error }` | Invalid payload or email format |
| `500 { error }` | Missing `NEXT_PUBLIC_CONVEX_URL` |
| `502 { error }` | Convex or Resend call failed |

## V2 ideas

- Typed `api` import once `convex/_generated` is committed (swap from `anyApi`)
- Referral counter using `waitlist.count`
- Admin page reading `waitlist.list` directly
- Double opt-in
- Honeypot / hCaptcha
