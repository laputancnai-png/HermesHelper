// src/features/dashboard/DashboardPage.tsx
import { useEffect, useState, useCallback } from "react";
import { theme as P } from "../../theme";
import { Btn } from "../../components/shared";
import { useLang } from "../../i18n";
import { Commands } from "../../lib/tauri";

const DASHBOARD_BASE = "http://127.0.0.1:9119";
const POLL_INTERVAL_MS = 500;
const POLL_MAX_ATTEMPTS = 30; // 15 seconds

export function DashboardPage() {
  const { t, lang } = useLang();
  const dashboardSrc = `${DASHBOARD_BASE}?lang=${lang === "zh" ? "zh-CN" : "en"}`;
  const [ready, setReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const startPolling = useCallback(() => {
    setReady(false);
    setTimedOut(false);
    setAttempts(0);
  }, []);

  useEffect(() => {
    if (ready || timedOut) return;

    let cancelled = false;
    let attempt = 0;

    const poll = async () => {
      while (!cancelled && attempt < POLL_MAX_ATTEMPTS) {
        attempt += 1;
        setAttempts(attempt);
        let ok = false;
        try { ok = await Commands.checkDashboardReady(); } catch { /* not ready */ }
        if (ok) {
          if (!cancelled) setReady(true);
          return;
        }
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      }
      if (!cancelled) setTimedOut(true);
    };

    void poll();
    return () => { cancelled = true; };
  }, [ready, timedOut]);

  if (ready) {
    return (
      <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
        <iframe
          src={dashboardSrc}
          style={{
            width: "100%", height: "100%", border: "none", display: "block",
            filter: "hue-rotate(50deg) saturate(0.88) brightness(1.02)",
          }}
          title="Hermes Dashboard"
        />
      </div>
    );
  }

  return (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: P.white, gap: 16,
    }}>
      {timedOut ? (
        <>
          <div style={{ fontSize: 36 }}>⚠️</div>
          <div style={{ fontSize: 14, color: P.ink, fontWeight: 700 }}>{t.dashboard.timeout}</div>
          <div style={{ fontSize: 12, color: P.soft }}>{t.dashboard.timeoutHint}</div>
          <Btn small onClick={startPolling}>{t.dashboard.retry}</Btn>
        </>
      ) : (
        <>
          <span className="spin" style={{ fontSize: 32 }}>⚙️</span>
          <div style={{ fontSize: 14, color: P.ink, fontWeight: 700 }}>{t.dashboard.loading}</div>
          <div style={{ fontSize: 12, color: P.soft }}>
            {t.dashboard.loadingHint} ({attempts}/{POLL_MAX_ATTEMPTS})
          </div>
        </>
      )}
    </div>
  );
}
