// Singleton Anthropic SDK client. Reads ANTHROPIC_API_KEY from the env at
// import time; throws clearly if missing so the brain fails loudly during
// dev rather than silently returning gibberish at request time.

import Anthropic from "@anthropic-ai/sdk";

function getKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key.trim() === "") {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (local dev) " +
        "or your hosting environment. The brain cannot run without it.",
    );
  }
  return key;
}

let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (_client === null) {
    _client = new Anthropic({ apiKey: getKey() });
  }
  return _client;
}
