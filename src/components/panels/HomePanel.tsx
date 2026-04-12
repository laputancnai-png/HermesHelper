import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Commands } from "../../lib/tauri";
import { useHermesStore, useUIStore } from "../../store";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { LogLine } from "../ui/LogLine";

export function HomePanel() {
  const { t } = useTranslation();
  const {
    isInstalled, version, doctorResults, doctorRunning,
    setDoctorResults, setDoctorRunning, setInstalled,
  } = useHermesStore();
  const { showToast, setActivePanel } = useUIStore();
  const [hasRunDoctor, setHasRunDoctor] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Commands.checkHermesVersion()
      .then((v) => {
        if (!cancelled) {
          const ver = typeof v === "string" ? v : null;
          setInstalled(!!ver, ver);
        }
      })
      .catch(() => { if (!cancelled) setInstalled(false, null); });
    return () => { cancelled = true; };
  }, [setInstalled]);

  async function handleRunDoctor() {
    setDoctorRunning(true);
    setHasRunDoctor(true);
    try {
      const results = await Commands.runDoctor();
      setDoctorResults(results);
    } catch (e) {
      const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
      showToast(`${t("toast.doctorFailed")}: ${msg}`, "error");
    } finally {
      setDoctorRunning(false);
    }
  }

  const passCount = doctorResults.filter((r) => r.status === "ok").length;
  const warnCount = doctorResults.filter((r) => r.status === "warn").length;
  const failCount = doctorResults.filter((r) => r.status === "fail").length;

  function doctorBadge() {
    if (!hasRunDoctor) return <Badge status="neutral">{t("home.notRun")}</Badge>;
    if (failCount > 0) return <Badge status="red">{warnCount + failCount} {t("home.issues")}</Badge>;
    if (warnCount > 0) return <Badge status="yellow">{warnCount} {t("home.warnings")}</Badge>;
    return <Badge status="green">{t("home.allPassed")}</Badge>;
  }

  return (
    <div className="space-y-3 max-w-3xl">
      {/* Status cards */}
      <div className="grid grid-cols-3 gap-[10px]">
        {/* Install status card */}
        <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]">
          <div className="text-[10px] text-text-tertiary font-[600] tracking-[.3px] uppercase mb-[6px]">
            {t("home.installStatus")}
          </div>
          <div className="text-[18px] font-[700] text-text-primary leading-none mb-[6px]">
            {isInstalled ? t("home.installed") : t("home.notInstalled")}
          </div>
          <Badge status={isInstalled ? "green" : "neutral"}>
            {isInstalled ? t("home.running") : t("home.notDetected")}
          </Badge>
        </div>

        {/* Version card */}
        <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]">
          <div className="text-[10px] text-text-tertiary font-[600] tracking-[.3px] uppercase mb-[6px]">
            {t("home.currentVersion")}
          </div>
          <div className="text-[18px] font-[700] text-text-primary leading-none mb-[6px]">
            {version ?? "—"}
          </div>
          {version
            ? <Badge status="accent">{t("home.detected")}</Badge>
            : <Badge status="neutral">{t("home.notDetected")}</Badge>
          }
        </div>

        {/* Doctor results card */}
        <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]">
          <div className="text-[10px] text-text-tertiary font-[600] tracking-[.3px] uppercase mb-[6px]">
            {t("home.doctorResults")}
          </div>
          <div className="text-[18px] font-[700] text-text-primary leading-none mb-[6px]">
            {hasRunDoctor ? `${passCount}✓ ${warnCount}⚠` : "—"}
          </div>
          {doctorBadge()}
        </div>
      </div>

      {/* System diagnosis card */}
      <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-[600] text-text-primary">
            {t("home.systemDiagnosis")}
          </span>
          <Button variant="primary" size="sm" onClick={handleRunDoctor} loading={doctorRunning}>
            {t("home.runDiagnosis")}
          </Button>
        </div>

        <div className="space-y-[4px]" aria-live="polite">
          {doctorResults.map((r) => (
            <LogLine
              key={`${r.status}-${r.message}`}
              status={r.status === "ok" ? "ok" : r.status === "warn" ? "warn" : "fail"}
              message={r.message}
            />
          ))}
        </div>

        {!isInstalled && !doctorRunning && doctorResults.length === 0 && (
          <p className="text-text-secondary text-[12px] mt-2">
            {t("home.notInstalledHint")}{" "}
            <button type="button" className="text-accent underline" onClick={() => setActivePanel("install")}>
              {t("home.goInstall")}
            </button>
          </p>
        )}
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]">
        <div className="text-[11px] text-text-tertiary font-[600] tracking-[.3px] uppercase mb-3">
          {t("home.quickActions")}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setActivePanel("install")}>
            {t("home.checkUpdate")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setActivePanel("config")}>
            {t("home.editConfig")}
          </Button>
        </div>
      </div>
    </div>
  );
}
