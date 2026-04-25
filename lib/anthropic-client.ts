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

// Convenience export for callers that prefer a value over a function.
// Lazy via a Proxy so importing this module doesn't blow up on a missing key
// in environments that don't actually use the brain (e.g. typecheck only).
export const anthropic: Anthropic = new Proxy({} as Anthropic, {
  get(_target, prop, receiver) {
    const real = getAnthropic();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
