export default function StatCard({ label, value, sub, icon: Icon, tone = "ink" }) {
  const toneMap = {
    ink:    "text-ink",
    accent: "text-accent",
    good:   "text-good",
    mid:    "text-mid",
    low:    "text-low",
    teal:   "text-teal",
  };
  return (
    <div className="bg-panel border border-border rounded-xl shadow-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] font-medium text-ink/50 uppercase tracking-wide">{label}</span>
        {Icon && <Icon size={16} className="text-ink/30" />}
      </div>
      <div className={`font-display text-[28px] font-semibold leading-none ${toneMap[tone]}`}>{value}</div>
      {sub && <div className="text-[12px] text-ink/45">{sub}</div>}
    </div>
  );
}
