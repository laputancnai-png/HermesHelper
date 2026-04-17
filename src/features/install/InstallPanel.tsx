// src/features/install/InstallPanel.tsx
import { useEffect, useRef, useState } from "react";
import { theme as P } from "../../theme";
import { Btn } from "../../components/shared";
import { Commands, Events, InstallProgress } from "../../lib/tauri";
import { useStore } from "../../store";
import { useLang } from "../../i18n";

type Phase = "idle" | "installing" | "done" | "error";

function timeBasedProgress(elapsed: number) {
  return Math.round(90 * (1 - Math.exp(-elapsed / 900)));
}

function formatElapsed(s: number) {
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function InstallPanel() {
  const { t } = useLang();
  const { installed, showToast, setStatus } = useStore();
  const [phase, setPhase] = useState<Phase>("idle");
  const [logs, setLogs] = useState<Array<InstallProgress & { id: number }>>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [showUninstallOpts, setShowUninstallOpts] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTo(0, el.scrollHeight);
  }, [logs]);

  useEffect(() => {
    if (phase === "installing") {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  async function refreshStatus() {
    try {
      const s = await Commands.getHermesStatus();
      setStatus(s.installed, s.version, s.running);
    } catch {}
  }

  async function handleInstall() {
    if (phase === "installing") return;
    setPhase("installing");
    setLogs([]);
    setErrorMsg("");

    const [unProg, unDone, unErr] = await Promise.all([
      Events.onInstallProgress(p => setLogs(prev => [...prev, { ...p, id: prev.length }])),
      Events.onInstallDone(() => {
        setPhase("done");
        showToast(t.toast.installSuccess, "success");
        // Force status refresh: gateway may take a moment to start
        setTimeout(refreshStatus, 1500);
        setTimeout(refreshStatus, 4000);
      }),
      Events.onInstallError(msg => { setPhase("error"); setErrorMsg(msg); showToast(msg, "error"); }),
    ]);

    try {
      await Commands.installHermes();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setPhase("error");
      setErrorMsg(msg);
      showToast(msg, "error");
    } finally {
      unProg(); unDone(); unErr();
    }
  }

  async function handleUninstall() {
    if (!confirm(t.install.uninstallConfirm)) return;
    try {
      await Commands.uninstallHermes();
      showToast(t.toast.uninstallSuccess, "success");
      setShowUninstallOpts(false);
      setTimeout(refreshStatus, 500);
    } catch (e) {
      showToast(`${t.toast.uninstallFailed}: ${e instanceof Error ? e.message : String(e)}`, "error");
    }
  }

  const visualPct = phase === "done" ? 100 : phase === "error" ? 0 : phase === "installing" ? timeBasedProgress(elapsed) : 0;
  // Show log only while installing or on error
  const showLog = phase === "installing" || phase === "error";

  return (
    <div style={{
      background: P.white, borderRadius: P.radius.xl,
      padding: "20px 24px", marginBottom: 12,
      boxShadow: P.shadow.panel, border: `2px solid ${P.border}`,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: "Fredoka One,cursive", fontSize: 18, color: P.ink }}>
            {t.install.title}
          </div>
          <div style={{ fontSize: 12, color: P.soft, marginTop: 2 }}>{t.install.desc}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn small color={P.indigo} onClick={handleInstall} disabled={phase === "installing"} loading={phase === "installing"}>
            {phase === "done" || installed ? t.install.reinstall : t.install.start}
          </Btn>
          {installed && (
            <Btn small ghost onClick={() => setShowUninstallOpts(s => !s)} disabled={phase === "installing"}>
              {t.install.uninstall}
            </Btn>
          )}
        </div>
      </div>

      {/* Uninstall confirm */}
      {showUninstallOpts && (
        <div style={{
          marginBottom: 12, padding: "10px 14px",
          background: "#FFF8F2", border: "1px solid #FFD8CC", borderRadius: 10,
        }}>
          <div style={{ fontSize: 12, color: P.coral, fontWeight: 700, marginBottom: 8 }}>
            {t.install.uninstallClean}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn small color={P.coral} onClick={handleUninstall}>{t.install.uninstall}</Btn>
            <Btn small ghost onClick={() => setShowUninstallOpts(false)}>取消</Btn>
          </div>
        </div>
      )}

      {/* Progress bar — shown during install or when done/error */}
      {phase !== "idle" && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: P.soft }}>{t.install.progress}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: phase === "done" ? P.teal : phase === "error" ? P.coral : P.indigo }}>
              {phase === "done" ? t.install.done : phase === "error" ? t.install.failed : formatElapsed(elapsed)}
            </span>
          </div>
          <div style={{ height: 6, background: "#EBEBF8", borderRadius: 3, overflow: "hidden", marginBottom: showLog ? 10 : 0 }}>
            <div style={{
              height: "100%", borderRadius: 3,
              width: `${visualPct}%`,
              background: phase === "error" ? P.coral : `linear-gradient(90deg, ${P.indigo}, #8B8FFF)`,
              transition: "width 1s ease-out",
            }} />
          </div>
        </>
      )}

      {/* Log area — only while installing or on error */}
      {showLog && (
        <div style={{
          background: "#1E1E2E", borderRadius: 12, overflow: "hidden",
          maxHeight: 240, display: "flex", flexDirection: "column",
        }}>
          <div style={{
            padding: "8px 14px", background: "#2A2A3E",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            borderBottom: "1px solid #3A3A4E",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {phase === "installing" && <span className="spin" style={{ fontSize: 13 }}>⚙️</span>}
              <span style={{ fontSize: 11, color: "#A0A0C0", fontWeight: 600 }}>{t.install.progress}</span>
            </div>
            <button
              onClick={() => setLogs([])}
              style={{
                background: "transparent", border: "1px solid #4A4A5E",
                borderRadius: 6, padding: "3px 10px", fontSize: 11,
                color: "#A0A0C0", cursor: "pointer",
              }}
            >
              {t.install.clearBtn}
            </button>
          </div>
          <div ref={logRef} style={{
            flex: 1, overflowY: "auto", padding: 12,
            fontFamily: "'SF Mono','Monaco','Consolas',monospace", fontSize: 11, lineHeight: 1.7,
          }}>
            {phase === "installing" && logs.length === 0 && (
              <div style={{ color: "#7070A0" }}>{t.install.waiting}</div>
            )}
            {logs.map(l => (
              <div key={l.id} style={{ color: "#A0A0C0", marginBottom: 2 }}>{l.line}</div>
            ))}
            {phase === "error" && (
              <div style={{ color: P.coral, marginTop: 4 }}>❌ {errorMsg}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
