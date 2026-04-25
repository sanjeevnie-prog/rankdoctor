import { ImageResponse } from "next/og";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { PublicDiagnosis } from "@/lib/types";
import { deriveShareCardFields, type ShareCardFields } from "@/lib/share-card";

// OG / twitter-card image for /d/{token}.
// Pulls share-card fields from lib/share-card.ts — same source of truth as
// the on-screen ShareCardPreview component, so the image and the in-page
// preview never drift apart.

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const alt = "rankdoctor diagnosis";

type CardData = (ShareCardFields & { ok: true }) | { ok: false };

async function loadCardData(token: string): Promise<CardData> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return { ok: false };
  try {
    const convex = new ConvexHttpClient(convexUrl);
    const row = (await convex.query(api.diagnoses.getByShareToken, { token })) as
      | PublicDiagnosis
      | null;
    if (!row) return { ok: false };
    return { ok: true, ...deriveShareCardFields(row) };
  } catch {
    return { ok: false };
  }
}

// Clip the top-finding to two lines' worth of text so the OG image matches
// the on-screen preview's `line-clamp-2` behavior. ImageResponse doesn't
// support line-clamp via CSS, so we cap it by character count.
const TOP_FINDING_MAX_CHARS = 130;
function clipTopFinding(s: string): string {
  if (s.length <= TOP_FINDING_MAX_CHARS) return s;
  return s.slice(0, TOP_FINDING_MAX_CHARS - 1).trimEnd() + "…";
}

export default async function OG({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await loadCardData(token);

  if (!data.ok) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0A0A0A",
            color: "#FFFFFF",
            fontFamily: "system-ui",
            fontSize: 48,
          }}
        >
          rankdoctor
        </div>
      ),
      size,
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0A0A0A",
          color: "#FFFFFF",
          fontFamily: "system-ui",
          padding: "72px 80px",
        }}
      >
        {/* top: brand + label */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            color: "#888888",
            fontSize: 18,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
          }}
        >
          <span style={{ color: "#FFFFFF", letterSpacing: "-0.02em", textTransform: "none", fontSize: 28, fontWeight: 600 }}>
            rankdoctor
          </span>
          <span>diagnosis</span>
        </div>

        {/* middle: rank hero + site/keyword */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div
            style={{
              fontSize: 84,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              color: "#FFFFFF",
            }}
          >
            {data.rankLine}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 16,
              fontSize: 28,
              color: "#BFBFBF",
            }}
          >
            <span style={{ color: "#FFFFFF" }}>{data.hostname}</span>
            <span style={{ color: "#666666" }}>·</span>
            <span>&quot;{data.keyword}&quot;</span>
          </div>
        </div>

        {/* bottom: top finding + brand bar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 22,
              color: "#888888",
              textTransform: "uppercase",
              letterSpacing: "0.22em",
            }}
          >
            top finding
          </div>
          <div
            style={{
              fontSize: 36,
              color: "#FFFFFF",
              lineHeight: 1.25,
              maxWidth: 1000,
            }}
          >
            {clipTopFinding(data.topFindingHeadline)}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
