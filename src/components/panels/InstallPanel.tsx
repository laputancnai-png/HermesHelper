import { useEffect, useRef, useState } from "react";
import { Commands, Events, InstallMode, InstallProgress } from "../../lib/tauri";
import { useUIStore } from "../../store";
import { Button } from "../ui/Button";
import { LogLine } from "../ui/LogLine";
import { Badge } from "../ui/Badge";

const MODES: { id: InstallMode; label: string; description: string }[] = [
  { id: "full", label: "完整安装", description: "包含消息网关、Cron、CLI 工具，约 180 MB（推荐）" },
  { id: "core", label: "仅核心", description: "最小安装，仅包含 CLI" },
  { id: "voice", label: "含 Voice", description: "完整安装 + 语音转录模块" },
];

type Phase = "idle" | "installing" | "done" | "error";

export function InstallPanel() {
  const { showToast } = useUIStore();
  const [selectedMode, setSelectedMode] = useState<InstallMode>("full");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<InstallProgress[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    const el = logRef.current;
    if (el && typeof el.scrollTo === "function") {
      el.scrollTo(0, el.scrollHeight);
    }
  }, [logs]);

  async function handleInstall() {
    setPhase("installing");
    setLogs([]);
    setProgress(0);

    // Start the install command immediately (invoke is recorded synchronously by the mock)
    const installPromise = Commands.installHermes(selectedMode);

    // Set up event listeners in parallel
    const [unlistenProgress, unlistenDone, unlistenError] = await Promise.all([
      Events.onInstallProgress((p) => {
        setLogs((prev) => [...prev, p]);
        setProgress(p.pct);
      }),
      Events.onInstallDone(() => {
        setPhase("done");
        setProgress(100);
        showToast("安装成功！", "success");
      }),
      Events.onInstallError((msg) => {
        setPhase("error");
        setErrorMsg(msg);
        showToast(msg, "error");
      }),
    ]);

    try {
      await installPromise;
    } catch (e) {
      setPhase("error");
      setErrorMsg(String(e));
    } finally {
      unlistenProgress();
      unlistenDone();
      unlistenError();
    }
  }

  async function handleUninstall() {
    if (!confirm("确定要卸载 Hermes 吗？此操作不可撤销。")) return;
    try {
      await Commands.uninstallHermes();
      showToast("已卸载 Hermes", "success");
    } catch (e) {
      showToast("卸载失败：" + String(e), "error");
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Mode selection */}
      <div className="bg-bg-2 border border-white/[0.07] rounded-lg p-4 space-y-3">
        <h3 className="text-[11px] font-mono uppercase tracking-widest text-text-2">选择安装模式</h3>
        <div className="space-y-2">
          {MODES.map((m) => (
            <label
              key={m.id}
              className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors duration-app ease-app
                ${
                  selectedMode === m.id
                    ? "bg-cyan/[0.06] border-cyan/30"
                    : "bg-bg-3 border-white/[0.07] hover:bg-bg-4"
                }`}
            >
              <input
                type="radio"
                name="mode"
                value={m.id}
                checked={selectedMode === m.id}
                onChange={() => setSelectedMode(m.id)}
                className="mt-0.5 accent-cyan"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-text-0 text-[13px] font-semibold">{m.label}</span>
                  {m.id === "full" && <Badge status="blue">推荐</Badge>}
                </div>
                <p className="text-text-1 text-[11px] mt-0.5">{m.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Progress */}
      {(phase === "installing" || phase === "done" || phase === "error") && (
        <div className="bg-bg-2 border border-white/[0.07] rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-mono uppercase tracking-widest text-text-2">安装进度</h3>
            <Badge status={phase === "done" ? "green" : phase === "error" ? "red" : "blue"}>
              {phase === "done" ? "完成" : phase === "error" ? "失败" : `${progress}%`}
            </Badge>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-bg-4 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                phase === "error" ? "bg-status-red" : "bg-cyan"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Log output */}
          <div
            ref={logRef}
            className="bg-bg-1 rounded-md p-3 max-h-48 overflow-y-auto space-y-0.5"
          >
            {logs.map((l, i) => (
              <LogLine key={i} status="muted" message={l.line} />
            ))}
            {phase === "error" && <LogLine status="fail" message={errorMsg} />}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button
          variant="primary"
          onClick={handleInstall}
          disabled={phase === "installing"}
          loading={phase === "installing"}
        >
          {phase === "done" ? "重新安装" : "开始安装"}
        </Button>

        <Button variant="danger" size="sm" onClick={handleUninstall} disabled={phase === "installing"}>
          卸载 Hermes
        </Button>
      </div>
    </div>
  );
}
