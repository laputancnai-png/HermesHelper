import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Commands, Events, InstallProgress } from "../../lib/tauri";
import { useUIStore } from "../../store";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";

type Phase = "idle" | "installing" | "done" | "error";

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function InstallPanel() {
  const { t } = useTranslation();
  const { showToast } = useUIStore();
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<Array<InstallProgress & { id: number }>>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-scroll log to bottom
  useEffect(() => {
    const el = logRef.current;
    if (el && typeof el.scrollTo === "function") {
      el.scrollTo(0, el.scrollHeight);
    }
  }, [logs]);

  // Elapsed timer: starts when installing, stops on done/error
  useEffect(() => {
    if (phase === "installing") {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  async function handleInstall() {
    if (phase === "installing") return;
    setPhase("installing");
    setLogs([]);
    setProgress(0);
    setErrorMsg("");

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
      await Commands.installHermes();
    } catch (e) {
      setPhase("error");
      const errMsg = e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
      setErrorMsg(errMsg);
      showToast(errMsg, "error");
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
      {/* Info card */}
      <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]">
        <div className="text-[11px] text-text-tertiary font-[600] tracking-[.3px] uppercase mb-3">
          {t("install.about")}
        </div>
        <p className="text-[13px] text-text-secondary leading-[1.6]">
          {t("install.aboutDesc")}
        </p>
        <div className="mt-3 px-3 py-2 bg-bg-window rounded-[8px] font-mono text-[11px] text-text-secondary break-all">
          curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
        </div>
      </div>

      {/* Progress card */}
      {(phase === "installing" || phase === "done" || phase === "error") && (
        <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-[600] text-text-primary">
                {t("install.progress")}
              </span>
              {phase === "installing" && elapsed > 0 && (
                <span className="text-[11px] text-text-tertiary font-mono">
                  {formatElapsed(elapsed)}
                </span>
              )}
            </div>
            <Badge status={progressBadgeStatus}>{progressBadgeText}</Badge>
          </div>

          {/* Progress bar */}
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

          {/* Waiting hint shown only when no log lines yet */}
          {phase === "installing" && logs.length === 0 && (
            <p className="text-[12px] text-text-tertiary mb-2 animate-pulse">
              {t("install.waiting")}
            </p>
          )}

          {/* Log area */}
          <div
            ref={logRef}
            className="max-h-[180px] overflow-y-auto space-y-[2px] font-mono text-[12px] text-text-secondary"
            aria-live="polite"
          >
            {logs.map((l) => (
              <div key={l.id}>{l.line}</div>
            ))}
            {phase === "error" && (
              <div className="text-status-red mt-1">❌ {errorMsg}</div>
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
