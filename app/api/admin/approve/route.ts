import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
// @ts-expect-error convex codegen
import { api } from "../../../../convex/_generated/api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  let id: string;
  let key: string;
  try {
    const body = (await request.json()) as { id?: unknown; key?: unknown };
    if (typeof body.id !== "string" || typeof body.key !== "string") {
      throw new Error("bad body");
    }
    id = body.id;
    key = body.key;
  } catch {
    // never leak existence — same generic shape as auth failure
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  try {
    const convex = new ConvexHttpClient(convexUrl);
    await convex.mutation(api.diagnoses.approve, { id, key });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    // either auth failure or row not found — collapse both to a generic { ok: false }
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
