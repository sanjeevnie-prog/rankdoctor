import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { createHash } from "node:crypto";
import { api } from "../../../convex/_generated/api";

export const runtime = "nodejs";

// Option B opt-in flow: fired by the frontend AFTER the diagnosis renders,
// when the user ticks the "ok to feature this" checkbox below their cards.
// Body: { share_token: string, optedIn: boolean }
//
// Auth: we recompute the ipHash from the request (IP + wd_uid cookie) and pass
// it to the mutation, which only patches the row when the ipHash matches the
// original submitter. So a random visitor with the share URL can't toggle
// someone else's opt-in.

const COOKIE_NAME = "wd_uid";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "0.0.0.0";
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

export async function POST(request: Request) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  let shareToken: string;
  let optedIn: boolean;
  try {
    const body = (await request.json()) as {
      share_token?: unknown;
      optedIn?: unknown;
    };
    if (typeof body.share_token !== "string" || typeof body.optedIn !== "boolean") {
      throw new Error("bad body");
    }
    shareToken = body.share_token;
    optedIn = body.optedIn;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Without a wd_uid cookie this caller never submitted a diagnosis on this
  // browser, so they can't possibly be the submitter — silent no-op.
  const cookieId = readCookie(request, COOKIE_NAME);
  if (!cookieId) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const ipHash = sha256Hex(`${getClientIp(request)}:${cookieId}`);

  try {
    const convex = new ConvexHttpClient(convexUrl);
    await convex.mutation(api.diagnoses.setOptIn, { shareToken, optedIn, ipHash });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
