import { useEffect } from "react";
import { Topbar } from "./components/layout/Topbar";
import { SegmentedControl } from "./components/layout/SegmentedControl";
import { Toast } from "./components/ui/Toast";
import { HomePanel } from "./components/panels/HomePanel";
import { InstallPanel } from "./components/panels/InstallPanel";
import { ConfigPanel } from "./components/panels/ConfigPanel";
import { useUIStore } from "./store";
import { initI18n, i18n } from "./lib/i18n";
import { Commands } from "./lib/tauri";

initI18n();

function PlaceholderPanel() {
  return (
    <div className="flex items-center justify-center h-full text-text-tertiary text-[13px]">
      Phase 2 即将推出
    </div>
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
      <div
        className="flex flex-col flex-shrink-0 bg-[rgba(246,246,246,.95)] border-b border-bg-secondary"
        style={{ backdropFilter: "blur(20px)" }}
      >
        <Topbar />
        <div className="flex justify-center pb-3">
          <SegmentedControl />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-5">
        {activePanel === "home"    && <HomePanel />}
        {activePanel === "install" && <InstallPanel />}
        {activePanel === "config"  && <ConfigPanel />}
        {(activePanel === "tools" || activePanel === "gateway" || activePanel === "migrate") && (
          <PlaceholderPanel />
        )}
      </main>

      <Toast />
    </div>
  );
}
