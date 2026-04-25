import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
// @ts-expect-error convex codegen
import { api } from "../../../convex/_generated/api";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_SOURCES = new Set(["rate_limited", "cap_reached", "waitlist_page"]);

export async function POST(request: Request) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  let email: string;
  let source: string;
  try {
    const body = (await request.json()) as { email?: unknown; source?: unknown };
    if (typeof body.email !== "string" || typeof body.source !== "string") {
      throw new Error("bad body");
    }
    email = body.email.trim().toLowerCase();
    source = body.source;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!EMAIL_RE.test(email) || !ALLOWED_SOURCES.has(source)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    const convex = new ConvexHttpClient(convexUrl);
    await convex.mutation(api.diagnoses.addWaitlistV2, { email, source });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("waitlistV2 insert failed:", err);
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
