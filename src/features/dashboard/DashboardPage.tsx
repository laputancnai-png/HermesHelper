// src/features/dashboard/DashboardPage.tsx
import { useEffect, useState, useCallback, useRef } from "react";
import { theme as P } from "../../theme";
import { Btn } from "../../components/shared";
import { useLang } from "../../i18n";
import { Commands } from "../../lib/tauri";

const POLL_INTERVAL_MS = 500;
const POLL_MAX_ATTEMPTS = 30;
const NAV_H = P.nav.height; // 56

function getBounds() {
  return { x: 0, y: NAV_H, width: window.innerWidth, height: window.innerHeight - NAV_H };
}

export function DashboardPage() {
  const { t, lang } = useLang();
  const [ready, setReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const shownRef = useRef(false);

  const startPolling = useCallback(() => {
    setReady(false);
    setTimedOut(false);
    setAttempts(0);
    shownRef.current = false;
  }, []);

  // Polling loop
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

  // Show child webview once ready
  useEffect(() => {
    if (!ready) return;
    const { x, y, width, height } = getBounds();
    shownRef.current = true;
    void Commands.showDashboard(lang, x, y, width, height);
    return () => { void Commands.hideDashboard(); };
  }, [ready]);

  // Sync language changes after webview is shown
  useEffect(() => {
    if (!ready || !shownRef.current) return;
    void Commands.setDashboardLanguage(lang);
  }, [lang, ready]);

  // Resize listener
  useEffect(() => {
    if (!ready) return;
    const onResize = () => {
      const { x, y, width, height } = getBounds();
      void Commands.resizeDashboard(x, y, width, height);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [ready]);

  if (ready) {
    // Child webview is shown natively — render invisible placeholder
    return <div style={{ width: "100%", height: "100%" }} />;
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
