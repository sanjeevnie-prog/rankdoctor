import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
// @ts-expect-error convex codegen
import { api } from "../../../convex/_generated/api";

export const runtime = "nodejs";

// Option B opt-in flow: fired by the frontend AFTER the diagnosis renders,
// when the user ticks the "ok to feature this" checkbox below their cards.
// Body: { share_token: string, optedIn: boolean }
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

  try {
    const convex = new ConvexHttpClient(convexUrl);
    await convex.mutation(api.diagnoses.setOptIn, { shareToken, optedIn });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    // mutation silently no-ops when the row is missing, so any error here is internal
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
