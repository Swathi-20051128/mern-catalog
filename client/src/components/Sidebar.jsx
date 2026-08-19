import { NavLink } from "react-router-dom";
import { FolderOpen, UploadCloud, Boxes, Bot } from "lucide-react";

const links = [
  { to: "/",       label: "My Uploads",     icon: FolderOpen,  end: true },
  { to: "/upload", label: "Upload File",    icon: UploadCloud },
];

export default function Sidebar() {
  return (
    <aside className="w-64 shrink-0 bg-sidebar text-white/90 flex flex-col h-screen sticky top-0">
      <div className="px-6 py-6 flex items-center gap-2.5 border-b border-white/10">
        <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
          <Boxes size={17} className="text-white" />
        </div>
        <div>
          <div className="font-display font-semibold text-[15px] leading-none text-white">CatalogIQ</div>
          <div className="text-[10.5px] text-white/45 mt-1 font-mono tracking-wide">AI AGENT · EDITION</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-colors ${
                isActive
                  ? "bg-accent text-white shadow-sm"
                  : "text-white/65 hover:bg-sidebar-hover hover:text-white"
              }`
            }
          >
            <Icon size={16} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-white/10 space-y-2">
        <div className="flex items-center gap-2 text-[11px] text-white/50">
          <Bot size={13} />
          <span className="font-mono">GPT-4o-mini / GPT-4o</span>
        </div>
        <div className="text-[10.5px] text-white/35 leading-relaxed">
          AI-Powered Product Intelligence
          <br />
          for Industrial Commerce
        </div>
      </div>
    </aside>
  );
}
