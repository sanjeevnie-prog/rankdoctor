// Fetch + parse the live page HTML.
//
// HARDENING RULE #1 (from POC round 2): use a real HTML parser for
// <title>, <meta>, <link rel=canonical>, <meta property=og:url>, and <h1>.
// Single-line regex misses multi-line content and nearly shipped a false
// "title is empty" finding. Tested mentally: <title>\n  some title\n</title>
// MUST resolve to "some title".

import { parse, HTMLElement } from "node-html-parser";

const FETCH_TIMEOUT_MS = 10_000;
const NORMALIZED_TEXT_CAP = 8_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; seo-diagnostic-bot/1.0; +https://growthx.club)";

export type PageHtmlData = {
  raw: string;
  normalizedText: string;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  ogUrl: string | null;
  h1: string | null;
};

export type PageHtmlResult =
  | { ok: true; data: PageHtmlData }
  | { ok: false; reason: string };

export async function fetchPageHtml(url: string): Promise<PageHtmlResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!res.ok) {
      return { ok: false, reason: `page fetch returned HTTP ${res.status}` };
    }

    const raw = await res.text();
    const root = parse(raw);

    const title = textOf(root.querySelector("title"));
    const metaDescription = attrOf(
      root.querySelector('meta[name="description"]'),
      "content",
    );
    const canonical = attrOf(
      root.querySelector('link[rel="canonical"]'),
      "href",
    );
    const ogUrl = attrOf(
      root.querySelector('meta[property="og:url"]'),
      "content",
    );
    const h1 = textOf(root.querySelector("h1"));

    const normalizedText = normalize(root);

    return {
      ok: true,
      data: { raw, normalizedText, title, metaDescription, canonical, ogUrl, h1 },
    };
  } catch (err) {
    const reason =
      err instanceof Error
        ? err.name === "AbortError"
          ? `page fetch timed out after ${FETCH_TIMEOUT_MS}ms`
          : `page fetch failed: ${err.message}`
        : "page fetch failed: unknown error";
    return { ok: false, reason };
  } finally {
    clearTimeout(timer);
  }
}

// HARDENING RULE #1 enforcement: collapse internal whitespace AFTER stripping
// scripts/styles/nav/footer. This means a multi-line <title> resolves to its
// trimmed inner text, not "". If the parser finds the element but the text
// is whitespace-only after trim, we return null (= "absent" to the model),
// not "" — this prevents the model from saying "title is empty string".
function textOf(el: HTMLElement | null): string | null {
  if (!el) return null;
  const t = el.text.replace(/\s+/g, " ").trim();
  return t === "" ? null : t;
}

function attrOf(el: HTMLElement | null, attr: string): string | null {
  if (!el) return null;
  const v = el.getAttribute(attr);
  if (!v) return null;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}

function normalize(root: HTMLElement): string {
  // strip noise — script/style/nav/footer
  for (const sel of ["script", "style", "nav", "footer", "noscript"]) {
    for (const node of root.querySelectorAll(sel)) {
      node.remove();
    }
  }
  const text = root.text.replace(/\s+/g, " ").trim();
  return text.length > NORMALIZED_TEXT_CAP
    ? text.slice(0, NORMALIZED_TEXT_CAP)
    : text;
}
