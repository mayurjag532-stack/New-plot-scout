export default function NotesPanel({
  owner,
  general,
  onOwnerChange,
  onGeneralChange
}: {
  owner: string;
  general: string;
  onOwnerChange: (v: string) => void;
  onGeneralChange: (v: string) => void;
}) {
  return (
    <div className="bg-field-card border border-field-line rounded-xl p-4">
      <h3 className="text-field-text font-semibold text-[15px] tracking-tight mb-1">Property Notes</h3>
      <p className="text-field-muted text-sm mb-3">Capture only decision-relevant context that is not already structured above.</p>
      <label className="block text-field-muted text-xs mb-1">Owner / broker / source note</label>
      <textarea value={owner} onChange={(e)=>onOwnerChange(e.target.value)} placeholder="Promises, clarifications, documents to send, negotiation context…" rows={2} className="w-full bg-field-panel border border-field-line rounded-lg px-3 py-2 text-field-text text-sm" />
      <label className="block text-field-muted text-xs mt-3 mb-1">General note</label>
      <textarea value={general} onChange={(e) => onGeneralChange(e.target.value)} placeholder="Anything else that could affect the decision…" rows={3} className="w-full bg-field-panel border border-field-line rounded-lg px-3 py-2 text-field-text text-sm" />
    </div>
  );
}
