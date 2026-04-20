// src/features/channels/WeChatDetail.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG as QRCode } from "qrcode.react";
import { theme as P } from "../../theme";
import { Btn } from "../../components/shared";
import { useLang } from "../../i18n";
import { Commands, Events, WeChatPhase } from "../../lib/tauri";

const CARD: React.CSSProperties = {
  background: P.white, borderRadius: P.radius.xl,
  border: `1.5px solid ${P.border}`, boxShadow: P.shadow.card,
  padding: "24px 28px", marginBottom: 16,
};

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function WeChatDetail() {
  const { t } = useLang();
  const c = t.channels.wechat;

  const [phase, setPhase] = useState<WeChatPhase>("deps_checking");
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [credentialMsg, setCredentialMsg] = useState<{ ok: boolean; msg: string } | null>(null);

  const logRef = useRef<HTMLDivElement>(null);

  const refreshStatus = useCallback(() => {
    Commands.getGatewayStatus().then(s => setRunning(s.running)).catch(() => {});
  }, []);

  const waitForGatewayRunning = useCallback(async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        const status = await Commands.getGatewayStatus();
        setRunning(status.running);
        if (status.running) {
          return;
        }
      } catch {
        // ignore transient status errors while the gateway is restarting
      }
      await sleep(1000);
    }
  }, []);

  useEffect(() => {
    let unlisten: (() => void)[] = [];
    Promise.all([
      Events.onWeChatSetupProgress(p => {
        if (p.line) setLogs(prev => [...prev, p.line]);
        if (p.qrUrl) setQrUrl(p.qrUrl);
        if (p.phase && p.phase !== "setup_running" && p.phase !== "deps_installing") {
          setPhase(p.phase as WeChatPhase);
        }
      }),
      Events.onWeChatSetupDone(async () => {
        setPhase("scan_waiting");
        try {
          await Commands.startGateway();
        } catch {
          // gateway may already be restarting; proceed anyway
        } finally {
          await waitForGatewayRunning();
          setPhase("done");
        }
      }),
      Events.onWeChatSetupError(msg => {
        setErrorMsg(msg);
        setPhase("idle");
      }),
    ]).then(fns => { unlisten = fns; });
    return () => unlisten.forEach(fn => fn());
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    Commands.checkWechatDeps().then(ok => {
      setPhase(ok ? "idle" : "deps_needed");
    }).catch(() => setPhase("deps_needed"));
    refreshStatus();
  }, []);

  async function handleInstallDeps() {
    setPhase("deps_installing");
    setLogs([]);
    setErrorMsg(null);
    try {
      await Commands.installWechatDeps();
      setPhase("idle");
    } catch {
      // error handled via event
    }
  }

  async function handleStartSetup() {
    setPhase("setup_running");
    setLogs([]);
    setQrUrl(null);
    setErrorMsg(null);
    try {
      await Commands.setupWechatGateway();
    } catch (e) {
      setErrorMsg(typeof e === "string" ? e : c.setupFailed);
      setPhase("idle");
    }
  }

  const handleCheckCredentials = useCallback(async () => {
    setChecking(true);
    setCredentialMsg(null);
    try {
      const found = await Commands.checkWechatCredentials();
      if (found) {
        setCredentialMsg({ ok: true, msg: c.credentialFound });
        try { await Commands.startGateway(); } catch { /* ignore */ }
        await waitForGatewayRunning();
        setPhase("done");
      } else {
        setCredentialMsg({ ok: false, msg: c.credentialNotFound });
      }
    } finally {
      setChecking(false);
    }
  }, [c.credentialFound, c.credentialNotFound, refreshStatus]);

  const LogArea = ({ maxHeight = 200 }: { maxHeight?: number }) => (
    <div style={{ marginTop: 12 }}>
      <button
        onClick={() => setShowLogs(v => !v)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 12, fontWeight: 700, color: P.soft, padding: "4px 0",
        }}
      >
        {showLogs ? c.hideLogs : c.showLogs} ({logs.length})
      </button>
      {showLogs && (
        <div ref={logRef} style={{
          marginTop: 8, background: "#1A1A2E", borderRadius: P.radius.md,
          padding: "12px 14px", maxHeight, overflowY: "auto",
          fontFamily: "monospace", fontSize: 11, color: "#C8C8E8", lineHeight: 1.6,
        }}>
          {logs.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 22 }}>💬</span>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: P.ink }}>{c.setupTitle}</h2>
          <span style={{
            marginLeft: 8, padding: "3px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700,
            background: running ? "#EAFAF3" : "#F5F5FA",
            color: running ? "#1A6A4A" : P.soft,
            border: `1.5px solid ${running ? "#A8EDD0" : P.border}`,
          }}>
            {running ? t.status.running : t.status.stopped}
          </span>
          {phase === "done" && (
            <span style={{
              padding: "3px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700,
              background: "#EAFAF3", color: "#1A6A4A", border: "1.5px solid #A8EDD0",
            }}>{c.done}</span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 13, color: P.soft }}>{c.setupDesc}</p>
      </div>

      {/* Error banner */}
      {errorMsg && (
        <div style={{
          ...CARD, padding: "12px 16px", marginBottom: 16,
          background: P.banner.error.bg, border: `1.5px solid ${P.banner.error.border}`,
          color: P.banner.error.text, fontSize: 13, fontWeight: 700,
        }}>
          {errorMsg}
        </div>
      )}

      {/* Phase: deps_checking */}
      {phase === "deps_checking" && (
        <div style={{ ...CARD, display: "flex", alignItems: "center", gap: 12 }}>
          <span className="spin">⚙️</span>
          <span style={{ fontSize: 13, color: P.soft }}>{c.depsChecking}</span>
        </div>
      )}

      {/* Phase: deps_needed */}
      {phase === "deps_needed" && (
        <div style={{
          ...CARD,
          background: P.banner.warning.bg, border: `1.5px solid ${P.banner.warning.border}`,
        }}>
          <div style={{ fontSize: 13, color: P.banner.warning.text, marginBottom: 14 }}>
            {c.depsNeeded}
          </div>
          <Btn onClick={handleInstallDeps} color={P.amber}>{c.depsInstall}</Btn>
        </div>
      )}

      {/* Phase: deps_installing */}
      {phase === "deps_installing" && (
        <div style={CARD}>
          <div style={{ fontSize: 13, fontWeight: 700, color: P.ink, marginBottom: 12 }}>
            <span className="spin">⚙️</span> {c.depsInstalling}
          </div>
          <div ref={logRef} style={{
            background: "#1A1A2E", borderRadius: P.radius.md,
            padding: "12px 14px", maxHeight: 240, overflowY: "auto",
            fontFamily: "monospace", fontSize: 11, color: "#C8C8E8", lineHeight: 1.6,
          }}>
            {logs.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      )}

      {/* Phase: idle (deps ready) */}
      {phase === "idle" && (
        <div style={CARD}>
          <div style={{
            padding: "10px 14px", borderRadius: P.radius.md, marginBottom: 20,
            background: P.banner.success.bg, border: `1.5px solid ${P.banner.success.border}`,
            color: P.banner.success.text, fontSize: 13, fontWeight: 700,
          }}>
            {c.depsDone}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Btn onClick={handleStartSetup} color={P.teal}>{c.startSetup}</Btn>
            <Btn onClick={handleCheckCredentials} loading={checking} color={P.indigo}>{c.checkCredentials}</Btn>
          </div>

          {credentialMsg && (
            <div style={{
              marginTop: 14, padding: "10px 14px", borderRadius: P.radius.md,
              fontSize: 13, fontWeight: 700,
              background: credentialMsg.ok ? P.banner.success.bg : P.banner.error.bg,
              color: credentialMsg.ok ? P.banner.success.text : P.banner.error.text,
              border: `1.5px solid ${credentialMsg.ok ? P.banner.success.border : P.banner.error.border}`,
            }}>
              {credentialMsg.msg}
            </div>
          )}
        </div>
      )}

      {/* Phase: setup_running — streaming log while waiting for QR */}
      {phase === "setup_running" && (
        <div style={CARD}>
          <div style={{ fontSize: 13, fontWeight: 700, color: P.ink, marginBottom: 12 }}>
            <span className="spin">⚙️</span> {c.setupRunning}
          </div>
          <div ref={logRef} style={{
            background: "#1A1A2E", borderRadius: P.radius.md,
            padding: "12px 14px", maxHeight: 200, overflowY: "auto",
            fontFamily: "monospace", fontSize: 11, color: "#C8C8E8", lineHeight: 1.6,
          }}>
            {logs.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      )}

      {/* Phase: qr_shown — display QR code for user to scan */}
      {phase === "qr_shown" && qrUrl && (
        <div style={CARD}>
          <div style={{ fontWeight: 800, fontSize: 14, color: P.ink, marginBottom: 6 }}>{c.qrTitle}</div>
          <div style={{ fontSize: 12, color: P.soft, marginBottom: 20 }}>{c.qrHint}</div>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <div style={{
              padding: 16, background: P.white,
              border: `2px solid ${P.border}`, borderRadius: P.radius.lg,
              display: "inline-block",
            }}>
              <QRCode value={qrUrl} size={200} level="M" />
            </div>
          </div>
          <LogArea />
        </div>
      )}

      {/* Phase: scan_waiting */}
      {phase === "scan_waiting" && (
        <div style={CARD}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span className="spin">⚙️</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: P.ink }}>
              {c.scanSuccess}
            </span>
          </div>
          <LogArea />
        </div>
      )}

      {/* Phase: done */}
      {phase === "done" && (
        <div style={CARD}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: "#16A34A", boxShadow: "0 0 0 4px #DCFCE7" }} />
            <div style={{ fontWeight: 800, fontSize: 14, color: P.ink }}>
              {c.done}
            </div>
          </div>
          <div style={{ fontSize: 13, color: P.soft, marginBottom: 16 }}>{c.setupDesc}</div>
          <LogArea />
        </div>
      )}
    </div>
  );
}
