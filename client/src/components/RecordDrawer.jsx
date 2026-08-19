import { X, AlertTriangle, Bot } from "lucide-react";
import ConfidenceBadge from "./ConfidenceBadge";

export default function RecordDrawer({ record, onClose }) {
  if (!record) return null;

  const fields = [
    ["Product Title", record.productTitle],
    ["Invoice Description (≤40 char, CAPS)", record.invoiceDesc],
    ["Mobile Description (60–80 char)", record.mobileDesc],
    ["Long Description", record.longDescription],
  ];

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-panel h-full overflow-y-auto shadow-2xl border-l border-border animate-in">
        <div className="sticky top-0 bg-panel border-b border-border px-6 py-4 flex items-start justify-between z-10">
          <div>
            <div className="text-[11px] font-mono text-ink/40 uppercase tracking-wide mb-1">{record.mpn}</div>
            <h2 className="font-display text-[18px] font-semibold text-ink">{record.itemType}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ink/5 text-ink/50">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          <div className="flex items-center gap-3">
            <ConfidenceBadge value={record.confidence} />
            {record.agentUsed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/10 text-accent text-[11.5px] font-medium">
                <Bot size={12} /> GPT AI Agent
              </span>
            )}
            {record.needsReview && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-low-soft text-low text-[11.5px] font-medium">
                <AlertTriangle size={12} /> Needs human review
              </span>
            )}
          </div>

          <section>
            <div className="text-[11px] font-mono uppercase tracking-wide text-ink/40 mb-1.5">Original input</div>
            <div className="bg-paper border border-border rounded-lg px-3 py-2.5 text-[13px] text-ink/70 italic">
              {record.originalDescription}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wide text-ink/40 mb-1">Manufacturer</div>
              <div className="text-[13.5px] font-medium">{record.manufacturer || "—"}</div>
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wide text-ink/40 mb-1">Brand</div>
              <div className="text-[13.5px] font-medium">{record.brand || "—"}</div>
              <div className="text-[10.5px] text-ink/40 mt-0.5">via {record.brandSource}</div>
            </div>
          </section>

          <section>
            <div className="text-[11px] font-mono uppercase tracking-wide text-ink/40 mb-1.5">Classpath</div>
            <div className="text-[13px] bg-teal-soft text-teal px-3 py-2 rounded-lg font-medium">
              {record.classpath}
            </div>
          </section>

          <section>
            <div className="text-[11px] font-mono uppercase tracking-wide text-ink/40 mb-2">
              Extracted attributes
            </div>
            {Object.keys(record.attributes || {}).length ? (
              <div className="flex flex-wrap gap-2">
                {Object.entries(record.attributes).map(([k, v]) => (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-accent-soft text-accent text-[12px] font-mono font-medium"
                  >
                    {k}: {v}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-[12.5px] text-ink/40 italic">none extracted</div>
            )}
          </section>

          <section className="space-y-4">
            <div className="text-[11px] font-mono uppercase tracking-wide text-ink/40">
              Generated description formats
            </div>
            {fields.map(([label, value]) => (
              <div key={label}>
                <div className="text-[10.5px] text-accent font-mono uppercase tracking-wide mb-1">{label}</div>
                <div className="text-[13px] leading-relaxed text-ink/80 border-l-2 border-border pl-3">
                  {value}
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
