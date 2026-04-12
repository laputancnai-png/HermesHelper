import { Sidebar } from "./components/layout/Sidebar";
import { Topbar } from "./components/layout/Topbar";
import { Toast } from "./components/ui/Toast";
import { HomePanel } from "./components/panels/HomePanel";
import { InstallPanel } from "./components/panels/InstallPanel";
import { ConfigPanel } from "./components/panels/ConfigPanel";
import { useUIStore } from "./store";

// Placeholder panels for Phase 2
function PlaceholderPanel({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center h-full text-text-1 font-mono text-sm">
      {name} — Phase 2
    </div>
  );
}

export default function App() {
  const { activePanel } = useUIStore();

  return (
    <div className="flex h-screen overflow-hidden bg-bg-0">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-5">
          {activePanel === "home" && <HomePanel />}
          {activePanel === "install" && <InstallPanel />}
          {activePanel === "config" && <ConfigPanel />}
          {activePanel === "tools" && <PlaceholderPanel name="Tools" />}
          {activePanel === "gateway" && <PlaceholderPanel name="Gateway" />}
          {activePanel === "migrate" && <PlaceholderPanel name="Migrate" />}
        </main>
      </div>
      <Toast />
    </div>
  );
}
