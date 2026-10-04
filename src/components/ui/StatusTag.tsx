import { BeforeTokenDecision } from "../../utils/decision";
import { PropertyStatus } from "../../types";

export type Tone = "good" | "warn" | "bad" | "neutral";

function Icon({ tone }: { tone: Tone }) {
  if (tone === "good")
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>;
  if (tone === "bad")
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>;
  if (tone === "warn")
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9 1.8 18a1.8 1.8 0 0 0 1.5 2.7h17.4a1.8 1.8 0 0 0 1.5-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" strokeDasharray="4 3" /><path d="M12 16h.01" /></svg>;
}

export function StatusTag({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className={`status-tag tone-${tone}`}>
      <Icon tone={tone} />
      {label}
    </span>
  );
}

const DECISION_TONE: Record<BeforeTokenDecision, Tone> = {
  PROCEED_TO_VERIFICATION: "good",
  HOLD_MORE_INFO: "warn",
  HIGH_CONCERN: "bad",
  INSUFFICIENT_DATA: "neutral"
};

export function decisionTone(id: BeforeTokenDecision): Tone { return DECISION_TONE[id]; }

export function DecisionTag({ id, label }: { id: BeforeTokenDecision; label: string }) {
  return <StatusTag tone={DECISION_TONE[id]} label={label} />;
}

const STATUS_TONE: Record<PropertyStatus, Tone> = {
  STRONG: "good",
  INVESTIGATE: "warn",
  REJECT: "bad",
  UNDECIDED: "neutral"
};

export function statusTone(status: PropertyStatus): Tone { return STATUS_TONE[status]; }

export function SignalTag({ status, label }: { status: PropertyStatus; label: string }) {
  return <StatusTag tone={STATUS_TONE[status]} label={label} />;
}
