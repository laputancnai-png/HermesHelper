import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Commands, ToolId } from "../../lib/tauri";
import { useUIStore } from "../../store";
import { Toggle } from "../ui/Toggle";

interface ToolDef {
  id: ToolId;
  labelKey: string;
  descKey: string;
}

const CORE_TOOLS: ToolDef[] = [
  { id: "terminal",  labelKey: "tools.terminal.label",  descKey: "tools.terminal.desc"  },
  { id: "file",      labelKey: "tools.file.label",      descKey: "tools.file.desc"      },
  { id: "web",       labelKey: "tools.web.label",       descKey: "tools.web.desc"       },
  { id: "memory",    labelKey: "tools.memory.label",    descKey: "tools.memory.desc"    },
  { id: "skills",    labelKey: "tools.skills.label",    descKey: "tools.skills.desc"    },
  { id: "todo",      labelKey: "tools.todo.label",      descKey: "tools.todo.desc"      },
  { id: "cronjob",   labelKey: "tools.cronjob.label",   descKey: "tools.cronjob.desc"   },
];

const OPTIONAL_TOOLS: ToolDef[] = [
  { id: "browser",   labelKey: "tools.browser.label",   descKey: "tools.browser.desc"   },
  { id: "vision",    labelKey: "tools.vision.label",    descKey: "tools.vision.desc"    },
  { id: "image_gen", labelKey: "tools.image_gen.label", descKey: "tools.image_gen.desc" },
  { id: "tts",       labelKey: "tools.tts.label",       descKey: "tools.tts.desc"       },
  { id: "moa",       labelKey: "tools.moa.label",       descKey: "tools.moa.desc"       },
];

export function ToolsPanel() {
  const { t } = useTranslation();
  const { showToast } = useUIStore();
  const [activeToolsets, setActiveToolsets] = useState<Set<ToolId>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    Commands.getTools()
      .then((toolsets) => {
        if (active) {
          setActiveToolsets(new Set(toolsets));
          setLoaded(true);
        }
      })
      .catch((e: unknown) => {
        if (active) {
          const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
          showToast(`${t("tools.loadFailed")}: ${msg}`, "error");
          setLoaded(true);
        }
      });
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  async function handleToggle(id: ToolId, checked: boolean) {
    const next = new Set(activeToolsets);
    if (checked) next.add(id);
    else next.delete(id);

    setActiveToolsets(next);

    try {
      await Commands.saveTools([...next]);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      setShowSaved(true);
      savedTimerRef.current = setTimeout(() => setShowSaved(false), 1500);
    } catch (e) {
      // rollback: invert only this toggle
      setActiveToolsets((current) => {
        const rolled = new Set(current);
        if (checked) rolled.delete(id);
        else rolled.add(id);
        return rolled;
      });
      const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
      showToast(`${t("tools.saveFailed")}: ${msg}`, "error");
    }
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-32 text-text-secondary text-[13px]">
        {t("tools.loading")}
      </div>
    );
  }

  function renderGroup(tools: ToolDef[], titleKey: string) {
    return (
      <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]">
        <div className="text-[11px] text-text-tertiary font-[600] tracking-[.3px] uppercase mb-3">
          {t(titleKey)}
        </div>
        <div className="space-y-4 divide-y divide-bg-secondary">
          {tools.map((tool, i) => (
            <div key={tool.id} className={i > 0 ? "pt-3" : ""}>
              <Toggle
                label={t(tool.labelKey)}
                description={t(tool.descKey)}
                checked={activeToolsets.has(tool.id)}
                onChange={(checked) => handleToggle(tool.id, checked)}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end h-5">
        {showSaved && (
          <span className="text-[12px] text-accent font-[600]">✓ {t("tools.saved")}</span>
        )}
      </div>
      {renderGroup(CORE_TOOLS, "tools.coreSection")}
      {renderGroup(OPTIONAL_TOOLS, "tools.optionalSection")}
    </div>
  );
}
