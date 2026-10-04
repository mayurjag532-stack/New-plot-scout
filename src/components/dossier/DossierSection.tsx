import { ReactNode } from "react";

export type SectionTone = "ready" | "in-progress" | "needs-attention" | "not-started";

/**
 * Dossier section — an editorial heading with a hairline, not a card.
 * Progressive disclosure: the heading carries the section's state, the body
 * opens/closes with a height transition (kept mounted so form state persists).
 */
export default function DossierSection({
  id, index, title, tone, stateLabel, summary, open, onToggle, delay = 0, children
}: {
  id: string;
  index: number;
  title: string;
  tone: SectionTone;
  stateLabel: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  delay?: number;
  children: ReactNode;
}) {
  const inert = open ? {} : ({ inert: "" } as Record<string, string>);
  return (
    <section id={id} className="ps-dsec ps-stagger" data-open={open} style={{ animationDelay: `${delay}ms` }}>
      <button
        type="button"
        className="ps-dsec-head"
        aria-expanded={open}
        aria-controls={`${id}-body`}
        onClick={onToggle}
      >
        <span className="ps-dsec-num" aria-hidden="true">{String(index).padStart(2, "0")}</span>
        <span className="ps-dsec-titles">
          <span className="ps-dsec-title">{title}</span>
          {summary && <span className="ps-dsec-summary">{summary}</span>}
        </span>
        <span className={`ps-dsec-state tone-${tone}`}>
          <i aria-hidden="true" />
          {stateLabel}
        </span>
        <svg className="ps-dsec-chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      <div className="ps-dsec-collapse" id={`${id}-body`} role="region" aria-label={title} {...inert}>
        <div className="ps-dsec-inner">
          <div className="ps-dsec-body">{children}</div>
        </div>
      </div>
    </section>
  );
}
