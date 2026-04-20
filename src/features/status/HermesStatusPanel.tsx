// src/features/status/HermesStatusPanel.tsx
import { useEffect } from "react";
import { theme as P } from "../../theme";
import { Commands } from "../../lib/tauri";
import { useStore } from "../../store";
import { useLang } from "../../i18n";

export function HermesStatusPanel() {
  const { t } = useLang();
  const { installed, version, running, setStatus } = useStore();

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const s = await Commands.getHermesStatus();
        if (alive) setStatus(s.installed, s.version, s.running);
      } catch {}
    }
    poll();
    const id = setInterval(poll, 10_000);
    return () => { alive = false; clearInterval(id); };
  }, [setStatus]);

  const bgStyle = running
    ? { background: "linear-gradient(135deg,#D8F7EC,#E8FFF5)", border: `3px solid #7FE8C4` }
    : installed
    ? { background: "linear-gradient(135deg,#DCF5FF,#E8F4FF)", border: `3px solid #90D8FF` }
    : { background: "linear-gradient(135deg,#FFF8E8,#FFF5E0)", border: `3px solid #FFE066` };

  const iconColor = running ? P.teal : installed ? "#2AA8D8" : P.amber;
  const statusText = running ? t.status.running : installed ? t.status.stopped : t.status.notInstalled;
  const statusColor = running ? P.teal : installed ? "#2AA8D8" : P.soft;

  return (
    <div className="slide-up" style={{
      ...bgStyle,
      borderRadius: P.radius.xl,
      padding: "18px 22px",
      marginBottom: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* Icon */}
        <div style={{
          width: 52, height: 52, borderRadius: P.radius.lg,
          background: iconColor, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 26,
          boxShadow: `0 4px 12px ${iconColor}66`, flexShrink: 0,
        }}>
          🤖
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "Fredoka One,cursive", fontSize: 18, color: P.ink }}>
            Hermes Agent
          </div>
          <div style={{ fontSize: 12, color: statusColor, fontWeight: 600, marginTop: 2 }}>
            {statusText}
          </div>
        </div>

        {/* Meta */}
        <div style={{ display: "flex", gap: 18, alignItems: "center", flexShrink: 0 }}>
          {version && (
            <div style={{ fontSize: 11 }}>
              <span style={{ fontWeight: 700, color: P.soft }}>{t.status.version} </span>
              <span style={{ color: P.ink, fontWeight: 700 }}>{version}</span>
            </div>
          )}
          {/* Gateway dot */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: running ? P.teal : P.soft,
              display: "inline-block",
              boxShadow: running ? `0 0 6px ${P.teal}` : "none",
              animation: running ? "none" : "pulse-dot 2s ease-in-out infinite",
            }} />
            <span style={{ fontWeight: 700, color: running ? P.teal : P.soft }}>
              {running ? t.status.gatewayConnected : t.status.gatewayOffline}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
