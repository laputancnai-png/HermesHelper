import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Commands, Events, InstallMode, InstallProgress } from "../../lib/tauri";
import { useUIStore } from "../../store";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";

type Phase = "idle" | "installing" | "done" | "error";

const MODES: { id: InstallMode; labelKey: string; descKey: string }[] = [
  { id: "full",  labelKey: "install.mode.full.label",  descKey: "install.mode.full.desc" },
  { id: "core",  labelKey: "install.mode.core.label",  descKey: "install.mode.core.desc" },
  { id: "voice", labelKey: "install.mode.voice.label", descKey: "install.mode.voice.desc" },
];

export function InstallPanel() {
  const { t } = useTranslation();
  const { showToast } = useUIStore();
  const [selectedMode, setSelectedMode] = useState<InstallMode>("full");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<Array<InstallProgress & { id: number }>>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el && typeof el.scrollTo === "function") {
      el.scrollTo(0, el.scrollHeight);
    }
  }, [logs]);

  async function handleInstall() {
    if (phase === "installing") return;  // re-entrancy guard (Fix I4)
    setPhase("installing");
    setLogs([]);
    setProgress(0);

    const [unlistenProgress, unlistenDone, unlistenError] = await Promise.all([
      Events.onInstallProgress((p) => {
        setLogs((prev) => [...prev, { ...p, id: prev.length }]);
        setProgress(p.pct);
      }),
      Events.onInstallDone(() => {
        setPhase("done");
        setProgress(100);
        showToast(t("toast.installSuccess"), "success");
      }),
      Events.onInstallError((msg) => {
        setPhase("error");
        setErrorMsg(msg);
        showToast(msg, "error");
      }),
    ]);

    try {
      await Commands.installHermes(selectedMode);
    } catch (e) {
      setPhase("error");
      const errMsg = e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
      setErrorMsg(errMsg);
      showToast(errMsg, "error");  // Fix I1: add showToast to catch path
    } finally {
      unlistenProgress();
      unlistenDone();
      unlistenError();
    }
  }

  async function handleUninstall() {
    if (!confirm(t("install.uninstallConfirm"))) return;
    try {
      await Commands.uninstallHermes();
      showToast(t("toast.uninstallSuccess"), "success");
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
      showToast(`${t("toast.uninstallFailed")}: ${errMsg}`, "error");
    }
  }

  const progressBadgeStatus: "green" | "red" | "accent" =
    phase === "done" ? "green" : phase === "error" ? "red" : "accent";
  const progressBadgeText =
    phase === "done" ? t("install.done") :
    phase === "error" ? t("install.failed") :
    `${progress}%`;

  return (
    <div className="space-y-3 max-w-2xl">
      {/* Mode selection card */}
      <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]">
        <div className="text-[11px] text-text-tertiary font-[600] tracking-[.3px] uppercase mb-3">
          {t("install.selectMode")}
        </div>
        <div className="space-y-2">
          {MODES.map((m) => (
            <label
              key={m.id}
              className={`flex items-start gap-3 p-3 rounded-[10px] border cursor-pointer transition-colors duration-150 ${
                selectedMode === m.id
                  ? "bg-accent-light border-accent border-[1.5px]"
                  : "bg-white border-bg-secondary hover:bg-bg-window"
              }`}
            >
              {/* Custom radio button */}
              <div className="mt-[2px] flex-shrink-0">
                <input
                  type="radio"
                  name="mode"
                  value={m.id}
                  checked={selectedMode === m.id}
                  onChange={() => setSelectedMode(m.id)}
                  className="sr-only"
                />
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    selectedMode === m.id
                      ? "border-accent bg-accent"
                      : "border-bg-secondary bg-white"
                  }`}
                >
                  {selectedMode === m.id && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-text-primary text-[13px] font-[500]">
                    {t(m.labelKey)}
                  </span>
                  {m.id === "full" && (
                    <Badge status="accent">{t("install.recommended")}</Badge>
                  )}
                </div>
                <p className="text-text-secondary text-[11px] mt-[3px]">{t(m.descKey)}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Progress card — only shown during/after install */}
      {(phase === "installing" || phase === "done" || phase === "error") && (
        <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-[600] text-text-primary">
              {t("install.progress")}
            </span>
            <Badge status={progressBadgeStatus}>{progressBadgeText}</Badge>
          </div>
          {/* Gradient progress bar */}
          <div className="h-[6px] bg-bg-secondary rounded-[3px] overflow-hidden mb-3">
            <div
              className={`h-full rounded-[3px] transition-all duration-300 ${
                phase === "error"
                  ? "bg-status-red"
                  : "bg-gradient-to-r from-accent to-[#4ECDE4]"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          {/* Log scroll area */}
          <div
            ref={logRef}
            className="max-h-[160px] overflow-y-auto space-y-[2px] font-mono text-[12px] text-text-secondary"
            aria-live="polite"
          >
            {logs.map((l) => (
              <div key={l.id}>{l.line}</div>
            ))}
            {phase === "error" && (
              <div className="text-status-red">❌ {errorMsg}</div>
            )}
          </div>
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center justify-between">
        <Button
          variant="primary"
          onClick={handleInstall}
          disabled={phase === "installing"}
          loading={phase === "installing"}
        >
          {phase === "done" ? t("install.reinstall") : t("install.start")}
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={handleUninstall}
          disabled={phase === "installing"}
        >
          {t("install.uninstall")}
        </Button>
      </div>
    </div>
  );
}
