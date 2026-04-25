import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";

export const runtime = "nodejs";

export async function GET() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    // safest default: pretend not closed and report zero — frontend will
    // still surface internal errors when /api/diagnose actually fails.
    return NextResponse.json({ total: 0, cap: 250, closed: false }, { status: 200 });
  }

  try {
    const convex = new ConvexHttpClient(convexUrl);
    const status = (await convex.query(api.diagnoses.getCapStatus, {})) as {
      total: number;
      cap: number;
      closed: boolean;
    };
    return NextResponse.json(status, { status: 200 });
  } catch (err) {
    console.error("getCapStatus failed:", err);
    return NextResponse.json({ total: 0, cap: 250, closed: false }, { status: 200 });
  }
}
