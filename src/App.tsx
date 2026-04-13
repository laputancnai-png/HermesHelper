import { useEffect } from "react";
import { SegmentedControl } from "./components/layout/SegmentedControl";
import { Toast } from "./components/ui/Toast";
import { HomePanel } from "./components/panels/HomePanel";
import { InstallPanel } from "./components/panels/InstallPanel";
import { ConfigPanel } from "./components/panels/ConfigPanel";
import { ToolsPanel } from "./components/panels/ToolsPanel";
import { useUIStore } from "./store";
import { initI18n, i18n } from "./lib/i18n";
import { Commands } from "./lib/tauri";
import { useTranslation } from "react-i18next";

initI18n();

function PlaceholderPanel() {
  return (
    <div className="flex items-center justify-center h-full text-text-tertiary text-[13px]">
      Phase 2 即将推出
    </div>
  );
}

function LangToggle() {
  const { i18n: i18nInst } = useTranslation();
  const currentLang = i18nInst.language?.startsWith("zh") ? "zh" : "en";
  function toggle() {
    i18nInst.changeLanguage(currentLang === "zh" ? "en" : "zh");
  }
  return (
    <button
      type="button"
      onClick={toggle}
      className="text-[12px] font-[600] text-text-secondary hover:text-text-primary px-2 py-1 rounded-[6px] hover:bg-black/[0.06] transition-colors duration-150 select-none"
    >
      {currentLang === "zh" ? "EN" : "中文"}
    </button>
  );
}

export default function App() {
  const { activePanel } = useUIStore();

  useEffect(() => {
    async function applyLanguage() {
      try {
        const cfg = await Commands.getConfig();
        const lang = cfg.language ?? "system";
        if (lang === "system") {
          const locale = await Commands.getSystemLocale();
          await i18n.changeLanguage(locale.startsWith("zh") ? "zh" : "en");
        } else {
          await i18n.changeLanguage(lang);
        }
      } catch {
        // keep default zh on error
      }
    }
    applyLanguage();
  }, []);

  return (
    <div
      className="flex flex-col h-screen bg-bg-window overflow-hidden"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}
    >
      {/* Header: segmented control centered, lang toggle on right */}
      <div
        className="flex items-center justify-center flex-shrink-0 bg-[rgba(246,246,246,.95)] border-b border-bg-secondary px-4 py-3 relative"
        style={{ backdropFilter: "blur(20px)" }}
      >
        <SegmentedControl />
        <div className="absolute right-4">
          <LangToggle />
        </div>
      </div>

      {/* Content centered, wider max-width */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6">
          {activePanel === "home"    && <HomePanel />}
          {activePanel === "install" && <InstallPanel />}
          {activePanel === "config"  && <ConfigPanel />}
          {activePanel === "tools" && <ToolsPanel />}
          {(activePanel === "gateway" || activePanel === "migrate") && (
            <PlaceholderPanel />
          )}
        </div>
      </main>

      <Toast />
    </div>
  );
}
