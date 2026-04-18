// src/features/dashboard/DashboardPage.tsx
import { useEffect, useState, useCallback, useRef } from "react";
import { theme as P } from "../../theme";
import { Btn } from "../../components/shared";
import { useLang } from "../../i18n";
import { Commands } from "../../lib/tauri";

const DASHBOARD_URL = "http://127.0.0.1:9119";
const POLL_INTERVAL_MS = 500;
const POLL_MAX_ATTEMPTS = 30; // 15 seconds

export function DashboardPage() {
  const { t, lang } = useLang();
  const [ready, setReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Send language preference to dashboard via postMessage (multiple formats)
  const syncLanguage = useCallback(() => {
    const cw = iframeRef.current?.contentWindow;
    if (!cw) return;
    const locale = lang === "zh" ? "zh-CN" : "en";
    [
      { type: "setLanguage", language: locale },
      { type: "locale", value: locale },
      { type: "i18n", lang: locale },
      { lang: locale },
    ].forEach(msg => cw.postMessage(msg, DASHBOARD_URL));
  }, [lang]);

  // Re-sync whenever lang changes (after iframe is loaded)
  useEffect(() => {
    if (iframeLoaded) syncLanguage();
  }, [lang, iframeLoaded, syncLanguage]);

  const handleIframeLoad = useCallback(() => {
    setIframeLoaded(true);
    syncLanguage();
  }, [syncLanguage]);

  const startPolling = useCallback(() => {
    setReady(false);
    setTimedOut(false);
    setAttempts(0);
    setIframeLoaded(false);
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
          ref={iframeRef}
          src={DASHBOARD_URL}
          onLoad={handleIframeLoad}
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
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
