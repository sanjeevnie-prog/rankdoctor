import { ConvexHttpClient } from "convex/browser";

/**
 * server-side convex client for use in RSC.
 *
 * NEXT_PUBLIC_CONVEX_URL is set by `npx convex dev` and read at request time.
 * if it's missing (e.g. during a build before backend is wired), getConvex()
 * throws — callers should handle that gracefully.
 */
export function getConvex(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_CONVEX_URL is not set. run `npx convex dev` once to provision the backend.",
    );
  }
  return new ConvexHttpClient(url);
}
