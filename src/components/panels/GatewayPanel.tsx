import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Commands, GatewayConfig, GatewayStatus } from "../../lib/tauri";
import { useUIStore } from "../../store";

export function GatewayPanel() {
  const { t } = useTranslation();
  const { showToast } = useUIStore();

  const [config, setConfig] = useState<GatewayConfig>({
    botToken: "",
    allowedUsers: "",
  });
  const [status, setStatus] = useState<GatewayStatus>({ running: false });
  const [showToken, setShowToken] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [actionLoading, setActionLoading] = useState<"start" | "stop" | null>(
    null
  );
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let active = true;

    Commands.getGatewayConfig()
      .then((c) => {
        if (active) setConfig(c);
      })
      .catch(() => {
        if (active) showToast(t("gateway.loadFailed"), "error");
      });

    Commands.getGatewayStatus()
      .then((s) => {
        if (active) setStatus(s);
      })
      .catch(() => {});

    pollIntervalRef.current = setInterval(() => {
      Commands.getGatewayStatus()
        .then((s) => {
          if (active) setStatus(s);
        })
        .catch(() => {});
    }, 3000);

    return () => {
      active = false;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  // showToast and t are intentionally omitted: showToast is a stable Zustand selector,
  // t changes on language switch which should not re-fetch config.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  async function handleSave() {
    try {
      await Commands.saveGatewayConfig(config.botToken, config.allowedUsers);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      setShowSaved(true);
      savedTimerRef.current = setTimeout(() => setShowSaved(false), 1500);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
      showToast(`${t("gateway.saveFailed")}: ${msg}`, "error");
    }
  }

  async function handleStart() {
    setActionLoading("start");
    try {
      await Commands.startGateway();
      // Wait 1.5s for hermes process to start before polling status
      setTimeout(() => {
        Commands.getGatewayStatus()
          .then((s) => {
            setStatus(s);
            if (!s.running) showToast(t("gateway.startFailed"), "error");
          })
          .catch(() => {})
          .finally(() => setActionLoading(null));
      }, 1500);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
      showToast(`${t("gateway.startFailed")}: ${msg}`, "error");
      setActionLoading(null);
    }
  }

  async function handleStop() {
    setActionLoading("stop");
    try {
      await Commands.stopGateway();
      const s = await Commands.getGatewayStatus();
      setStatus(s);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
      showToast(`${t("gateway.stopFailed")}: ${msg}`, "error");
    } finally {
      setActionLoading(null);
    }
  }

  const startDisabled =
    !config.botToken || actionLoading !== null || status.running;
  const stopDisabled = actionLoading !== null || !status.running;

  return (
    <div className="space-y-3">
      {/* Config card */}
      <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] text-text-tertiary font-[600] tracking-[.3px] uppercase">
            {t("gateway.section")}
          </div>
          <div className="h-5">
            {showSaved && (
              <span className="text-[12px] text-accent font-[600]">
                ✓ {t("gateway.saved")}
              </span>
            )}
          </div>
        </div>

        {/* Bot Token */}
        <div className="mb-3">
          <div className="text-[11px] text-text-primary font-[500] mb-1">
            {t("gateway.botToken")}
          </div>
          <div className="flex gap-2">
            <input
              type={showToken ? "text" : "password"}
              value={config.botToken}
              onChange={(e) =>
                setConfig({ ...config, botToken: e.target.value })
              }
              className="flex-1 bg-bg-secondary rounded-[8px] px-3 py-[7px] text-[11px] font-mono border border-border text-text-primary outline-none"
            />
            <button
              onClick={() => setShowToken(!showToken)}
              className="bg-bg-secondary rounded-[8px] px-3 py-[7px] text-[11px] font-[500] border border-border text-text-primary whitespace-nowrap"
            >
              {showToken ? t("gateway.hide") : t("gateway.show")}
            </button>
          </div>
        </div>

        {/* Allowed Users */}
        <div className="mb-4">
          <div className="text-[11px] text-text-primary font-[500] mb-1">
            {t("gateway.allowedUsers")}
          </div>
          <input
            type="text"
            value={config.allowedUsers}
            onChange={(e) =>
              setConfig({ ...config, allowedUsers: e.target.value })
            }
            className="w-full bg-bg-secondary rounded-[8px] px-3 py-[7px] text-[11px] border border-border text-text-primary outline-none"
          />
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          className="w-full bg-accent text-white text-[12px] font-[600] py-[9px] rounded-[9px]"
        >
          {t("gateway.saveConfig")}
        </button>
      </div>

      {/* Status + Controls card */}
      <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] text-text-tertiary font-[600] tracking-[.3px] uppercase mb-1">
              {t("gateway.statusSection")}
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  status.running ? "bg-green-500" : "bg-orange-400"
                }`}
              />
              <span className="text-[13px] font-[600] text-text-primary">
                {actionLoading === "start"
                  ? t("gateway.starting")
                  : actionLoading === "stop"
                  ? t("gateway.stopping")
                  : status.running
                  ? t("gateway.running")
                  : t("gateway.stopped")}
              </span>
              {status.running && (
                <span className="text-[11px] text-text-secondary bg-bg-secondary px-[6px] py-[2px] rounded">
                  Telegram
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleStart}
              disabled={startDisabled}
              title={!config.botToken ? t("gateway.noTokenHint") : undefined}
              className={`text-[12px] font-[600] px-4 py-[7px] rounded-[8px] ${
                startDisabled
                  ? "bg-bg-secondary text-text-tertiary"
                  : "bg-green-500 text-white"
              }`}
            >
              {actionLoading === "start" ? "..." : t("gateway.start")}
            </button>
            <button
              onClick={handleStop}
              disabled={stopDisabled}
              className={`text-[12px] font-[600] px-4 py-[7px] rounded-[8px] ${
                stopDisabled
                  ? "bg-bg-secondary text-text-tertiary"
                  : "bg-red-500 text-white"
              }`}
            >
              {actionLoading === "stop" ? "..." : t("gateway.stop")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
