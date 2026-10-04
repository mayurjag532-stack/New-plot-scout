import { OWNER_QUESTIONS, OwnerAnswers } from "../types";
import {
  isLegacyOwnerAnswer,
  STRUCTURED_OWNER_OPTIONS
} from "../utils/structuredOwnerAnswers";

export default function OwnerQuestionsPanel({
  answers,
  onChange,
  notes,
  onNotesChange
}: {
  answers: OwnerAnswers;
  onChange: (id: string, value: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
}) {
  return (
    <div className="bg-field-card border border-field-line rounded-xl p-4">
      <h3 className="text-field-text font-semibold text-[15px] tracking-tight mb-1">Owner Questions</h3>
      <p className="text-field-muted text-sm mb-3">Standard property due-diligence questions to ask the owner.</p>

      <div className="space-y-3">
        {OWNER_QUESTIONS.map((q) => {
          const options = STRUCTURED_OWNER_OPTIONS[q.id];
          const currentValue = answers[q.id] || "";
          const legacy = isLegacyOwnerAnswer(q.id, currentValue);

          return (
            <div key={q.id}>
              <label className="text-field-text text-sm block mb-1">{q.text}</label>

              {options ? (
                <>
                  {legacy && (
                    <div className="mb-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                      <p className="text-xs font-semibold text-amber-200">Needs re-verification</p>
                      <p className="mt-1 text-xs text-field-muted">
                        Previous answer: <span className="text-field-text">{currentValue}</span>
                      </p>
                      <p className="mt-1 text-[11px] text-field-muted">
                        Select one structured answer below. The previous text is preserved until you choose.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2" role="group" aria-label={q.text}>
                    {options.map((option) => {
                      const selected = currentValue === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => onChange(q.id, option)}
                          aria-pressed={selected}
                          className={`rounded-lg border px-3 py-2 text-sm transition ${selected ? "border-field-accent bg-field-accent/10 text-field-accent" : "border-field-line bg-field-panel text-field-muted"}`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <input
                  value={currentValue}
                  onChange={(e) => onChange(q.id, e.target.value)}
                  className="w-full bg-field-panel border border-field-line rounded-lg px-3 py-2 text-field-text text-sm"
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 bg-field-panel rounded-lg p-3">
        <p className="text-field-muted text-xs italic">
          If asked why you're buying: "Investment / apne use ke liye property dekh raha hoon. Location suitable hui toh aage decide karunga."
        </p>
      </div>

      <textarea
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Additional owner notes..."
        rows={3}
        className="w-full mt-3 bg-field-panel border border-field-line rounded-lg px-3 py-2 text-field-text text-sm"
      />
    </div>
  );
}
