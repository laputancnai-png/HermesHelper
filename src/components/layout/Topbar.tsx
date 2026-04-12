import { useUIStore } from "../../store";

const PANEL_TITLES: Record<string, string> = {
  home: "总览",
  install: "安装 / 更新",
  config: "基础配置",
  tools: "工具开关",
  gateway: "消息网关",
  migrate: "导入 / 导出",
};

const PANEL_TAGS: Record<string, string> = {
  home: "dashboard",
  install: "installation",
  config: "configuration",
  tools: "tools",
  gateway: "gateway",
  migrate: "migration",
};

export function Topbar() {
  const { activePanel } = useUIStore();

  return (
    <header className="h-12 bg-bg-1 border-b border-white/[0.07] flex items-center px-5 gap-3 flex-shrink-0">
      <span className="text-text-0 font-ui font-semibold text-sm">
        {PANEL_TITLES[activePanel]}
      </span>
      <span className="text-[10px] font-mono text-text-2 bg-bg-4 px-2 py-0.5 rounded">
        {PANEL_TAGS[activePanel]}
      </span>
    </header>
  );
}
