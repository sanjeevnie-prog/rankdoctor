// SERP "fetcher" — NOT A REAL HTTP FETCHER.
//
// The locked decision (scope.md) is to use Anthropic's web_search server
// tool instead of SerpAPI / DataForSEO. That tool runs inside Anthropic's
// infrastructure during the Claude turn — there is nothing for us to fetch
// here on the Node side.
//
// This module's only job is to embed a clear, model-readable hint in the
// user message telling Claude to use web_search to look up the SERP.
// The orchestrator (lib/diagnose.ts) declares the web_search tool on the
// API call and runs the SDK tool-use loop until Claude is done.

export function buildSerpSearchHint(url: string, keyword: string): string {
  // Single line — easy for Claude to spot in the user message.
  return (
    `For SERP context, use the web_search tool to find the top 10 Google ` +
    `results for the keyword "${keyword}" (English, US/India locale ok), ` +
    `and identify whether ${url} appears in those results and at what rank.`
  );
}
