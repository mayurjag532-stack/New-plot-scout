import { CHECKLIST_ITEMS, ChecklistState } from "../types";

export default function SiteChecklist({
  checklist,
  onChange,
  notes,
  onNotesChange
}: {
  checklist: ChecklistState;
  onChange: (id: string, value: boolean | null) => void;
  notes: string;
  onNotesChange: (v: string) => void;
}) {
  return (
    <div className="bg-field-card border border-field-line rounded-xl p-4">
      <h3 className="text-field-text font-semibold text-[15px] tracking-tight mb-1">Site Checklist</h3>
      <p className="text-field-muted text-sm mb-3">What you personally observe on the ground. Not shown to the owner.</p>

      <div className="space-y-2">
        {CHECKLIST_ITEMS.map((item) => {
          const val = checklist[item.id] ?? null;
          return (
            <div key={item.id} className="flex items-center justify-between gap-3 bg-field-panel rounded-lg px-3 py-2.5">
              <span className="text-field-text text-sm flex-1">{item.label}</span>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => onChange(item.id, val === true ? null : true)}
                  className={`w-9 h-9 rounded-lg text-sm font-bold ${
                    val === true ? "bg-field-good text-field-bg" : "bg-field-bg text-field-muted border border-field-line"
                  }`}
                  aria-label="Yes"
                >
                  ✓
                </button>
                <button
                  onClick={() => onChange(item.id, val === false ? null : false)}
                  className={`w-9 h-9 rounded-lg text-sm font-bold ${
                    val === false ? "bg-field-bad text-field-bg" : "bg-field-bg text-field-muted border border-field-line"
                  }`}
                  aria-label="No"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <textarea
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Additional site notes..."
        rows={3}
        className="w-full mt-3 bg-field-panel border border-field-line rounded-lg px-3 py-2 text-field-text text-sm"
      />
    </div>
  );
}
