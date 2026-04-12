import { useUIStore, Panel } from "../../store";

interface NavItem {
  id: Panel;
  label: string;
  icon: string;
  section: string;
  dotColor?: "green" | "yellow";
}

const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "总览", icon: "⌂", section: "system" },
  { id: "install", label: "安装 / 更新", icon: "↓", section: "system" },
  { id: "config", label: "基础配置", icon: "⚙", section: "configure" },
  { id: "tools", label: "工具开关", icon: "🔧", section: "configure" },
  { id: "gateway", label: "消息网关", icon: "⇄", section: "configure", dotColor: "yellow" },
  { id: "migrate", label: "导入 / 导出", icon: "⇅", section: "data" },
];

const SECTIONS = ["system", "configure", "data"];

export function Sidebar() {
  const { activePanel, setActivePanel } = useUIStore();

  return (
    <aside className="w-56 flex-shrink-0 bg-bg-1 border-r border-white/[0.07] flex flex-col overflow-hidden">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/[0.07]">
        <div className="w-7 h-7 rounded-md bg-cyan/10 border border-cyan/30 flex items-center justify-center text-cyan text-xs font-mono font-bold">
          H
        </div>
        <span className="font-ui font-bold text-text-0 text-sm tracking-wide">Hermes</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {SECTIONS.map((section) => (
          <div key={section} className="mb-1">
            <div className="px-4 py-1.5 text-[10px] font-mono font-bold text-text-2 uppercase tracking-widest">
              {section}
            </div>
            {NAV_ITEMS.filter((i) => i.section === section).map((item) => (
              <button
                key={item.id}
                onClick={() => setActivePanel(item.id)}
                className={`w-full flex items-center gap-2.5 px-4 py-2 text-[12px] transition-colors duration-app ease-app
                  ${
                    activePanel === item.id
                      ? "bg-cyan/[0.08] text-text-0 border-r-2 border-cyan"
                      : "text-text-1 hover:bg-bg-2 hover:text-text-0"
                  }`}
              >
                <span className="text-[14px] w-4 text-center">{item.icon}</span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.dotColor && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      item.dotColor === "green" ? "bg-status-green" : "bg-status-yellow"
                    }`}
                  />
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/[0.07]">
        <p className="text-[10px] font-mono text-text-2">Nous Research · Hermes</p>
      </div>
    </aside>
  );
}
