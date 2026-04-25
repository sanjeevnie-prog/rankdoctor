"use client";

import { useState, type FormEvent } from "react";

export type DiagnoseFormProps = {
  onSubmit: (input: { url: string; keyword: string }) => void;
  disabled?: boolean;
};

export function DiagnoseForm({ onSubmit, disabled }: DiagnoseFormProps) {
  const [url, setUrl] = useState("");
  const [keyword, setKeyword] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim() || !keyword.trim()) return;
    onSubmit({ url: url.trim(), keyword: keyword.trim() });
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4" noValidate>
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
            className="w-full rounded-[12px] border border-border bg-bg-card px-4 py-3 text-[15px] text-text placeholder:text-text-muted outline-none focus:border-text-soft transition-colors"
          />
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
          disabled={disabled || !url.trim() || !keyword.trim()}
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
