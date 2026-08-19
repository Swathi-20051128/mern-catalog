import { Database, Bot } from "lucide-react";

export default function Topbar({ title, subtitle, badge, actions }) {
  return (
    <header className="border-b border-border bg-panel/80 backdrop-blur sticky top-0 z-10">
      <div className="px-8 py-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[22px] font-semibold text-ink leading-tight">{title}</h1>
          {subtitle && <p className="text-[13px] text-ink/50 mt-1 max-w-2xl">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-1">
          {badge && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono font-medium border bg-good-soft text-good border-good/20">
              <Database size={12} />
              {badge}
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono font-medium border bg-accent/10 text-accent border-accent/20">
            <Bot size={12} />
            GPT-4o-mini
          </div>
          {actions}
        </div>
      </div>
    </header>
  );
}
