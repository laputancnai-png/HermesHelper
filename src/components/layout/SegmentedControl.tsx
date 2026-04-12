import { useTranslation } from "react-i18next";
import { useUIStore } from "../../store";
import type { Panel } from "../../store";

interface Segment {
  id: Panel;
  labelKey: string;
  phase2?: boolean;
}

const SEGMENTS: Segment[] = [
  { id: "home",    labelKey: "nav.home" },
  { id: "install", labelKey: "nav.install" },
  { id: "config",  labelKey: "nav.config" },
  { id: "tools",   labelKey: "nav.tools",   phase2: true },
  { id: "gateway", labelKey: "nav.gateway", phase2: true },
  { id: "migrate", labelKey: "nav.migrate", phase2: true },
];

export function SegmentedControl() {
  const { activePanel, setActivePanel, showToast } = useUIStore();
  const { t } = useTranslation();

  function handleClick(seg: Segment) {
    if (seg.phase2) {
      showToast(t("nav.phase2Coming"), "info");
      return;
    }
    setActivePanel(seg.id);
  }

  return (
    <div className="flex bg-black/[0.06] rounded-[9px] p-[3px] gap-[2px]">
      {SEGMENTS.map((seg) => (
        <button
          key={seg.id}
          onClick={() => handleClick(seg)}
          className={`px-[14px] py-[5px] rounded-[7px] text-[13px] transition-all duration-150 ${
            activePanel === seg.id
              ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,.12)] font-[600] text-text-primary"
              : "font-[500] text-text-secondary hover:text-text-primary"
          }`}
        >
          {t(seg.labelKey)}
        </button>
      ))}
    </div>
  );
}
