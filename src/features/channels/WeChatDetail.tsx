// src/features/channels/WeChatDetail.tsx
import { useEffect, useRef, useState, useCallback } from "react";
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

const INPUT: React.CSSProperties = {
  flex: 1, boxSizing: "border-box",
  border: `1.5px solid ${P.border}`, borderRadius: P.radius.md,
  padding: "10px 14px", fontSize: 14, color: P.ink,
  fontFamily: "Nunito,sans-serif", outline: "none",
  background: P.white,
};

const CODE_BLOCK: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  background: "#F7F7FF", border: `1.5px solid ${P.border}`,
  borderRadius: P.radius.md, padding: "10px 14px", marginTop: 10,
};

export function WeChatDetail() {
  const { t } = useLang();
  const c = t.channels.wechat;

  const [phase, setPhase] = useState<WeChatPhase>("deps_checking");
  const [logs, setLogs] = useState<string[]>([]);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [pairCode, setPairCode] = useState("");
  const [approving, setApproving] = useState(false);
  const [pairResult, setPairResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [credentialMsg, setCredentialMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);

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
        setRestarting(true);
        setPhase("scan_waiting");
        try {
          await Commands.startGateway();
        } catch {
          // gateway may already be restarting; proceed anyway
        } finally {
          setRestarting(false);
          setPhase("pairing");
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
        setRestarting(true);
        try { await Commands.startGateway(); } catch { /* ignore */ }
        setRestarting(false);
        setPhase("pairing");
      } else {
        setCredentialMsg({ ok: false, msg: c.credentialNotFound });
      }
    } finally {
      setChecking(false);
    }
  }, [c.credentialFound, c.credentialNotFound]);

  async function handleApprove() {
    if (!pairCode.trim()) return;
    setApproving(true);
    setPairResult(null);
    try {
      await Commands.approvePairing("weixin", pairCode.trim());
      setPairResult({ ok: true, msg: c.pairOk });
      setPhase("done");
    } catch (e) {
      setPairResult({ ok: false, msg: typeof e === "string" ? e : c.pairFail });
    } finally {
      setApproving(false);
    }
  }

  const copyCommand = useCallback(() => {
    navigator.clipboard.writeText(c.setupCommand).then(() => {
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 1500);
    });
  }, [c.setupCommand]);

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
            <button
              onClick={() => setPhase("setup_waiting")}
              style={{
                background: "none", border: `1.5px solid ${P.border}`, borderRadius: P.radius.md,
                padding: "8px 16px", fontSize: 13, color: P.soft, cursor: "pointer",
                fontFamily: "Nunito,sans-serif", fontWeight: 700,
              }}
            >
              {c.setupWaitingTitle}
            </button>
          </div>
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
              {restarting ? "✅ 扫码成功，正在重启 Gateway..." : c.scanSuccess}
            </span>
          </div>
          <LogArea />
        </div>
      )}

      {/* Phase: setup_waiting — fallback: guide user to run in terminal */}
      {phase === "setup_waiting" && (
        <div style={CARD}>
          <div style={{ fontWeight: 800, fontSize: 14, color: P.ink, marginBottom: 12 }}>
            {c.setupWaitingTitle}
          </div>
          <div style={{ fontSize: 13, color: P.soft, marginBottom: 6, lineHeight: 1.6 }}>
            {c.setupInstruction}
          </div>
          <div style={CODE_BLOCK}>
            <code style={{ flex: 1, fontSize: 14, fontWeight: 700, color: P.ink, fontFamily: "monospace" }}>
              {c.setupCommand}
            </code>
            <button
              onClick={copyCommand}
              style={{
                background: copiedCmd ? P.teal : P.indigo,
                color: "#fff", border: "none", borderRadius: 8,
                padding: "5px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                transition: "background 0.15s", flexShrink: 0,
              }}
            >
              {copiedCmd ? t.channels.copied : t.channels.copy}
            </button>
          </div>

          <div style={{ fontSize: 12, color: P.soft, marginTop: 20, marginBottom: 12, lineHeight: 1.6 }}>
            {c.setupWaitingHint}
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <Btn onClick={handleCheckCredentials} loading={checking} color={P.teal}>
              {c.checkCredentials}
            </Btn>
            <button
              onClick={() => setPhase("idle")}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 13, color: P.soft, padding: "6px 0",
              }}
            >
              ← 返回
            </button>
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

      {/* Phase: pairing / done */}
      {(phase === "pairing" || phase === "done") && (
        <div style={CARD}>
          <div style={{ fontWeight: 800, fontSize: 14, color: P.ink, marginBottom: 6 }}>
            {c.pairingTitle}
          </div>
          <div style={{ fontSize: 13, color: P.soft, marginBottom: 16 }}>{c.pairingDesc}</div>

          <div style={{ fontSize: 12, fontWeight: 700, color: P.soft, marginBottom: 8 }}>
            {c.pairingStep1}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: P.soft, marginBottom: 8, marginTop: 14 }}>
            {c.pairingStep2}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              type="text"
              value={pairCode}
              onChange={e => { setPairCode(e.target.value); setPairResult(null); }}
              placeholder={c.pairingCodePlaceholder}
              style={{ ...INPUT, fontFamily: "monospace", fontSize: 16, letterSpacing: 2, fontWeight: 700 }}
              onKeyDown={e => { if (e.key === "Enter") handleApprove(); }}
            />
            <Btn onClick={handleApprove} loading={approving} disabled={!pairCode.trim()}>
              {c.approvePairing}
            </Btn>
          </div>

          {pairResult && (
            <div style={{
              marginTop: 14, padding: "10px 14px", borderRadius: P.radius.md,
              fontSize: 13, fontWeight: 700,
              background: pairResult.ok ? P.banner.success.bg : P.banner.error.bg,
              color: pairResult.ok ? P.banner.success.text : P.banner.error.text,
              border: `1.5px solid ${pairResult.ok ? P.banner.success.border : P.banner.error.border}`,
            }}>
              {pairResult.msg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
