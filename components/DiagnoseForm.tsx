"use client";

import { useState, type FormEvent } from "react";

export type DiagnoseFormProps = {
  onSubmit: (input: { url: string; keyword: string }) => void;
  disabled?: boolean;
};

// Real URL check — must parse AND have an http/https scheme.
// Spec flow: "is it a real URL? starts with http, has a dot."
function isValidUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed === "") return false;
  try {
    const u = new URL(trimmed);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

export function DiagnoseForm({ onSubmit, disabled }: DiagnoseFormProps) {
  const [url, setUrl] = useState("");
  const [keyword, setKeyword] = useState("");

  const urlValid = isValidUrl(url);
  const keywordValid = keyword.trim() !== "";
  // Only show the URL error after the user has typed something — empty input
  // is "in progress," not "invalid."
  const showUrlError = url.trim() !== "" && !urlValid;
  const canSubmit = urlValid && keywordValid && !disabled;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ url: url.trim(), keyword: keyword.trim() });
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block">
          <span className="block text-xs uppercase tracking-[0.18em] text-text-muted mb-2">
            url
          </span>
          <input
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://yoursite.com/page-that-dropped"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={disabled}
            required
            aria-invalid={showUrlError}
            className="w-full rounded-[12px] border border-border bg-bg-card px-4 py-3 text-[15px] text-text placeholder:text-text-muted outline-none focus:border-text-soft transition-colors aria-[invalid=true]:border-severity-critical/60"
          />
          {showUrlError && (
            <p className="mt-1.5 text-[11px] text-severity-critical">
              needs a full URL including https://
            </p>
          )}
        </label>

        <label className="block">
          <span className="block text-xs uppercase tracking-[0.18em] text-text-muted mb-2">
            target keyword
          </span>
          <input
            type="text"
            autoComplete="off"
            placeholder="e.g. best running shoes"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            disabled={disabled}
            required
            className="w-full rounded-[12px] border border-border bg-bg-card px-4 py-3 text-[15px] text-text placeholder:text-text-muted outline-none focus:border-text-soft transition-colors"
          />
        </label>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-[12px] bg-text px-5 py-3 text-sm font-medium text-bg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-text-soft transition-colors w-full sm:w-auto"
        >
          diagnose
        </button>
        <p className="text-xs text-text-muted">
          takes about 15-30 seconds. we fetch SERP, page history, pagespeed, algo updates.
        </p>
      </div>
    </form>
  );
}
