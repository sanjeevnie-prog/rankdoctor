import type { DiagnosisCause, Severity } from "@/lib/types";

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "critical",
  high: "high",
  medium: "medium",
};

const SEVERITY_DOT: Record<Severity, string> = {
  critical: "bg-severity-critical",
  high: "bg-severity-high",
  medium: "bg-severity-medium",
};

const SEVERITY_TEXT: Record<Severity, string> = {
  critical: "text-severity-critical",
  high: "text-severity-high",
  medium: "text-severity-medium",
};

export function DiagnosisCard({ cause, index }: { cause: DiagnosisCause; index: number }) {
  return (
    <article className="rounded-[12px] border border-border bg-bg-card p-6 md:p-7">
      <header className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-block h-2 w-2 rounded-full ${SEVERITY_DOT[cause.severity]}`}
            aria-hidden
          />
          <span
            className={`text-[11px] uppercase tracking-[0.22em] ${SEVERITY_TEXT[cause.severity]}`}
          >
            {SEVERITY_LABEL[cause.severity]}
          </span>
        </div>
        <span className="font-mono text-[11px] text-text-muted tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </span>
      </header>

      <h3 className="text-[19px] md:text-xl font-medium text-text leading-snug tracking-[-0.01em]">
        {cause.headline}
      </h3>

      <p className="mt-3 text-[15px] leading-relaxed text-text-soft">
        {cause.explanation}
      </p>

      <div className="my-5 h-px bg-border-soft" />

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-[0.22em] text-text-muted">
          fix
        </span>
        <p className="text-[15px] leading-relaxed text-text">{cause.fix}</p>
      </div>

      {typeof cause.confidence === "number" && (
        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border-soft px-2.5 py-1 text-[11px] text-text-muted">
          <span>confidence</span>
          <span className="text-text-soft tabular-nums">
            {Math.round(cause.confidence * 100)}%
          </span>
        </div>
      )}
    </article>
  );
}
