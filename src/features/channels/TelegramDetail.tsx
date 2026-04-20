// src/features/channels/TelegramDetail.tsx
import { useEffect, useState, useCallback } from "react";
import { theme as P } from "../../theme";
import { Btn } from "../../components/shared";
import { useLang } from "../../i18n";
import { Commands, GatewayConfig, BotInfo } from "../../lib/tauri";

const CARD: React.CSSProperties = {
  background: P.white, borderRadius: P.radius.xl,
  border: `1.5px solid ${P.border}`, boxShadow: P.shadow.card,
  padding: "28px 32px", marginBottom: 20,
};

const LABEL: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 700,
  color: P.soft, marginBottom: 6, letterSpacing: 0.4,
};

const INPUT: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  border: `1.5px solid ${P.border}`, borderRadius: P.radius.md,
  padding: "10px 14px", fontSize: 14, color: P.ink,
  fontFamily: "Nunito,sans-serif", outline: "none",
  background: P.white,
};

const STEP_NUM: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 999,
  background: P.indigo, color: "#fff",
  fontSize: 12, fontWeight: 800,
  display: "flex", alignItems: "center", justifyContent: "center",
  flexShrink: 0,
};

export function TelegramDetail() {
  const { t } = useLang();
  const c = t.channels;

  const [cfg, setCfg] = useState<GatewayConfig>({ botToken: "", allowedUsers: "" });
  const [running, setRunning] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [botInfo, setBotInfo] = useState<BotInfo | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyErr, setVerifyErr] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState("");
  const [approving, setApproving] = useState(false);
  const [pairResult, setPairResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [copiedUsername, setCopiedUsername] = useState(false);

  const refreshStatus = useCallback(() => {
    Commands.getGatewayStatus().then(s => setRunning(s.running)).catch(() => {});
  }, []);

  useEffect(() => {
    Commands.getGatewayConfig().then(setCfg).catch(() => {});
    refreshStatus();
  }, [refreshStatus]);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      await Commands.saveGatewayConfig(cfg.botToken, cfg.allowedUsers);
      await Commands.startGateway();
      setMsg({ type: "ok", text: c.saved });
    } catch {
      setMsg({ type: "err", text: c.saveFailed });
    } finally {
      setSaving(false);
      setTimeout(refreshStatus, 1200);
    }
  }

  async function handleToggle() {
    try {
      if (running) {
        await Commands.stopGateway();
      } else {
        await Commands.startGateway();
      }
    } catch {
      setMsg({ type: "err", text: c.toggleFailed });
    } finally {
      setTimeout(refreshStatus, 1200);
    }
  }

  async function handleVerify() {
    if (!cfg.botToken.trim()) return;
    setVerifying(true);
    setVerifyErr(null);
    setBotInfo(null);
    setPairResult(null);
    setInputCode("");
    try {
      const info = await Commands.verifyBotToken(cfg.botToken.trim());
      setBotInfo(info);
    } catch (e) {
      setVerifyErr(typeof e === "string" ? e : c.verifyFail);
    } finally {
      setVerifying(false);
    }
  }

  async function handleApprove() {
    if (!inputCode.trim()) return;
    setApproving(true);
    setPairResult(null);
    try {
      await Commands.approvePairing("telegram", inputCode.trim());
      setPairResult({ ok: true, msg: c.pairOk });
    } catch (e) {
      setPairResult({ ok: false, msg: typeof e === "string" ? e : c.pairFail });
    } finally {
      setApproving(false);
    }
  }

  const copyUsername = useCallback((name: string) => {
    navigator.clipboard.writeText(`@${name}`).then(() => {
      setCopiedUsername(true);
      setTimeout(() => setCopiedUsername(false), 1500);
    });
  }, []);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 22 }}>✈️</span>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: P.ink }}>Telegram</h2>
          <span style={{
            marginLeft: 8, padding: "3px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700,
            background: running ? "#EAFAF3" : "#F5F5FA",
            color: running ? "#1A6A4A" : P.soft,
            border: `1.5px solid ${running ? "#A8EDD0" : P.border}`,
          }}>
            {running ? c.statusOn : c.statusOff}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: P.soft }}>{c.desc}</p>
      </div>

      {/* Setup Guide */}
      <div style={CARD}>
        <div style={{ fontWeight: 800, fontSize: 14, color: P.ink, marginBottom: 16 }}>{c.setupTitle}</div>
        {[c.step1, c.step2, c.step3].map((step, i) => (
          <div key={i} style={{ display: "flex", gap: 12, marginBottom: i < 2 ? 14 : 0, alignItems: "flex-start" }}>
            <div style={STEP_NUM}>{i + 1}</div>
            <div style={{ fontSize: 13, color: P.ink, lineHeight: 1.6, paddingTop: 4 }}
              dangerouslySetInnerHTML={{ __html: step }} />
          </div>
        ))}
      </div>

      {/* Config */}
      <div style={CARD}>
        <div style={{ fontWeight: 800, fontSize: 14, color: P.ink, marginBottom: 20 }}>{c.configTitle}</div>

        <div style={{ marginBottom: 18 }}>
          <label style={LABEL}>{c.botToken}</label>
          <div style={{ position: "relative" }}>
            <input
              type={showToken ? "text" : "password"}
              value={cfg.botToken}
              onChange={e => { setCfg({ ...cfg, botToken: e.target.value }); setBotInfo(null); setVerifyErr(null); }}
              placeholder={c.tokenPlaceholder}
              style={{ ...INPUT, paddingRight: 70 }}
            />
            <button
              onClick={() => setShowToken(!showToken)}
              style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 700, color: P.soft,
              }}
            >
              {showToken ? c.hide : c.show}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={LABEL}>{c.allowedUsers}</label>
          <input
            type="text"
            value={cfg.allowedUsers}
            onChange={e => setCfg({ ...cfg, allowedUsers: e.target.value })}
            placeholder={c.usersPlaceholder}
            style={INPUT}
          />
          <div style={{ marginTop: 6, fontSize: 11, color: P.soft }}>{c.usersHint}</div>
        </div>

        {msg && (
          <div style={{
            marginBottom: 16, padding: "10px 14px", borderRadius: P.radius.md, fontSize: 13, fontWeight: 700,
            background: msg.type === "ok" ? P.banner.success.bg : P.banner.error.bg,
            color: msg.type === "ok" ? P.banner.success.text : P.banner.error.text,
            border: `1.5px solid ${msg.type === "ok" ? P.banner.success.border : P.banner.error.border}`,
          }}>
            {msg.text}
          </div>
        )}

        <div style={{ display: "flex", gap: 12 }}>
          <Btn onClick={handleSave} loading={saving}>{c.save}</Btn>
          <Btn onClick={handleToggle} color={running ? P.coral : P.teal} ghost={!running} small>
            {running ? c.stopGateway : c.startGateway}
          </Btn>
        </div>
      </div>

      {/* Pairing */}
      <div style={CARD}>
        <div style={{ fontWeight: 800, fontSize: 14, color: P.ink, marginBottom: 6 }}>{c.pairingTitle}</div>
        <div style={{ fontSize: 13, color: P.soft, marginBottom: 20 }}>{c.pairingDesc}</div>

        <Btn onClick={handleVerify} loading={verifying} small color={P.teal}>
          {c.verifyToken}
        </Btn>

        {verifyErr && (
          <div style={{
            marginTop: 14, padding: "10px 14px", borderRadius: P.radius.md,
            background: P.banner.error.bg, color: P.banner.error.text,
            border: `1.5px solid ${P.banner.error.border}`,
            fontSize: 13, fontWeight: 700,
          }}>
            {verifyErr}
          </div>
        )}

        {botInfo && (
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: P.soft, marginBottom: 8 }}>{c.pairingStep1}</div>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "#F7F7FF", border: `1.5px solid ${P.border}`,
                borderRadius: P.radius.md, padding: "10px 14px",
              }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: P.ink, flex: 1, fontFamily: "monospace" }}>
                  @{botInfo.username}
                </span>
                <button
                  onClick={() => copyUsername(botInfo.username)}
                  style={{
                    background: copiedUsername ? P.teal : P.indigo,
                    color: "#fff", border: "none", borderRadius: 8,
                    padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                    transition: "background 0.15s", flexShrink: 0,
                  }}
                >
                  {copiedUsername ? c.copied : c.copy}
                </button>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: P.soft, marginBottom: 8 }}>{c.pairingStep2}</div>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  type="text"
                  value={inputCode}
                  onChange={e => { setInputCode(e.target.value); setPairResult(null); }}
                  placeholder={c.pairingCodePlaceholder}
                  style={{ ...INPUT, flex: 1, fontFamily: "monospace", fontSize: 16, letterSpacing: 2, fontWeight: 700 }}
                  onKeyDown={e => { if (e.key === "Enter") handleApprove(); }}
                />
                <Btn onClick={handleApprove} loading={approving} disabled={!inputCode.trim()}>
                  {c.approvePairing}
                </Btn>
              </div>
            </div>

            {pairResult && (
              <div style={{
                padding: "10px 14px", borderRadius: P.radius.md, fontSize: 13, fontWeight: 700,
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
    </div>
  );
}
