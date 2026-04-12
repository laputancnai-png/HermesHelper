import { useEffect, useState } from "react";
import { Commands, DoctorResult } from "../../lib/tauri";
import { useHermesStore, useUIStore } from "../../store";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { LogLine } from "../ui/LogLine";

function StatusCard({ label, value, badge }: { label: string; value: string; badge?: React.ReactNode }) {
  return (
    <div className="bg-bg-2 border border-white/[0.07] rounded-lg p-4">
      <p className="text-text-2 text-[10px] font-mono uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <span className="text-text-0 text-sm font-semibold">{value}</span>
        {badge}
      </div>
    </div>
  );
}

export function HomePanel() {
  const { isInstalled, version, doctorResults, doctorRunning, setDoctorResults, setDoctorRunning, setInstalled } =
    useHermesStore();
  const { showToast, setActivePanel } = useUIStore();
  const [hasRunDoctor, setHasRunDoctor] = useState(false);

  // Check installed status on mount
  useEffect(() => {
    let cancelled = false;
    Commands.checkHermesVersion()
      .then((v) => {
        if (!cancelled) {
          // Guard: only accept a string version or null
          const version = typeof v === "string" ? v : null;
          setInstalled(!!version, version);
        }
      })
      .catch(() => { if (!cancelled) setInstalled(false, null); });
    return () => { cancelled = true; };
  }, [setInstalled]);

  async function handleRunDoctor() {
    setDoctorRunning(true);
    setHasRunDoctor(true);
    try {
      const results = await Commands.runDoctor();
      setDoctorResults(results);
    } catch (e) {
      showToast("诊断失败：" + String(e), "error");
    } finally {
      setDoctorRunning(false);
    }
  }

  const passCount = doctorResults.filter((r) => r.status === "ok").length;
  const warnCount = doctorResults.filter((r) => r.status === "warn").length;
  const failCount = doctorResults.filter((r) => r.status === "fail").length;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Status cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatusCard
          label="安装状态"
          value={isInstalled ? "已安装" : "未安装"}
          badge={<Badge status={isInstalled ? "green" : "grey"}>{isInstalled ? "运行中" : "未检测到"}</Badge>}
        />
        <StatusCard
          label="当前版本"
          value={version ?? "—"}
          badge={version ? <Badge status="blue">已检测</Badge> : undefined}
        />
        <StatusCard label="诊断结果" value={hasRunDoctor ? `${passCount}✓ ${warnCount}ℹ ${failCount}✗` : "未运行"} />
      </div>

      {/* Doctor section */}
      <div className="bg-bg-2 border border-white/[0.07] rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-mono uppercase tracking-widest text-text-2">系统诊断</h3>
          <Button size="sm" onClick={handleRunDoctor} loading={doctorRunning}>
            运行诊断
          </Button>
        </div>

        {doctorResults.length > 0 && (
          <div className="bg-bg-1 rounded-md p-3 space-y-0.5 max-h-48 overflow-y-auto">
            {doctorResults.map((r, i) => (
              <LogLine
                key={i}
                status={r.status === "ok" ? "ok" : r.status === "fail" ? "fail" : "info"}
                message={r.message}
              />
            ))}
          </div>
        )}

        {!isInstalled && !doctorRunning && (
          <p className="text-text-1 text-[12px]">
            Hermes 未安装。{" "}
            <button
              className="text-cyan underline"
              onClick={() => setActivePanel("install")}
            >
              前往安装
            </button>
          </p>
        )}
      </div>

      {/* Recent activity */}
      <RecentActivity />

      {/* Quick actions */}
      <div className="bg-bg-2 border border-white/[0.07] rounded-lg p-4">
        <h3 className="text-[11px] font-mono uppercase tracking-widest text-text-2 mb-3">快速操作</h3>
        <div className="flex gap-3">
          <Button size="sm" onClick={() => setActivePanel("install")}>检查更新</Button>
          <Button size="sm" onClick={() => setActivePanel("config")}>修改配置</Button>
        </div>
      </div>
    </div>
  );
}

// Reads last 10 lines from ~/.hermes/hermes.log via Rust command
function RecentActivity() {
  const [lines, setLines] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    import("../../lib/tauri").then(({ Commands }) =>
      Commands.getRecentActivity()
        .then((result) => { if (!cancelled) setLines(result); })
        .catch(() => {})
    );
    return () => { cancelled = true; };
  }, []);
  if (lines.length === 0) return null;
  return (
    <div className="bg-bg-2 border border-white/[0.07] rounded-lg p-4 space-y-2">
      <h3 className="text-[11px] font-mono uppercase tracking-widest text-text-2">最近活动</h3>
      <div className="space-y-0.5">
        {lines.map((l, i) => <LogLine key={i} status="muted" message={l} />)}
      </div>
    </div>
  );
}
