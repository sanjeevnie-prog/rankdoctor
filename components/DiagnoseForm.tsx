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
    <form onSubmit={handleSubmit} className="w-full space-y-3 text-left">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted mb-2 ml-5">
            URL
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
            className="w-full rounded-full border border-black/20 bg-white px-5 py-3.5 text-[15px] text-black placeholder:text-black/40 outline-none focus:border-black transition-colors aria-[invalid=true]:border-red-500/70"
          />
          {showUrlError && (
            <p className="mt-1.5 ml-5 text-[12px] text-severity-critical">
              Needs a full URL including https://
            </p>
          )}
        </label>

        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted mb-2 ml-5">
            Target keyword
          </span>
          <input
            type="text"
            autoComplete="off"
            placeholder="e.g. best running shoes"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            disabled={disabled}
            required
            className="w-full rounded-full border border-border bg-bg px-5 py-3.5 text-[15px] text-text placeholder:text-text-muted outline-none focus:border-text transition-colors"
          />
        </label>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full sm:w-auto rounded-full px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_6px_18px_-6px_rgba(239,68,68,0.55)] active:translate-y-[1px] transition-all bg-[#EF4444] hover:bg-[#DC2626] hover:shadow-[0_8px_22px_-6px_rgba(239,68,68,0.7)] disabled:bg-[#FCA5A5] disabled:shadow-none disabled:cursor-not-allowed"
        >
          Diagnose →
        </button>
        <p className="text-[12px] text-text-muted sm:text-right">
          Takes about 90 seconds. No signup.
        </p>
      </div>
    </form>
  );
}
