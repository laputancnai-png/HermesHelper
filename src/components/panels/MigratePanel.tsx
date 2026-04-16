import { useState } from "react";
import { useTranslation } from "react-i18next";
import { open, save } from "@tauri-apps/plugin-dialog";
import { Commands, ImportFileInfo, ImportSummary } from "../../lib/tauri";
import { useUIStore } from "../../store";

const EXPORT_ITEMS = [
  "config",
  "memory",
  "skills",
  "history",
  "cron",
  "hooks",
] as const;
type ExportItem = (typeof EXPORT_ITEMS)[number];

export function MigratePanel() {
  const { t } = useTranslation();
  const { showToast } = useUIStore();

  const [activeTab, setActiveTab] = useState<"export" | "import">("export");

  // Export state
  const [selectedItems, setSelectedItems] = useState<Set<ExportItem>>(
    new Set(EXPORT_ITEMS)
  );
  const [includeApiKeys, setIncludeApiKeys] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Import state
  const [zipPath, setZipPath] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportFileInfo[] | null>(
    null
  );
  const [fileSelections, setFileSelections] = useState<
    Record<string, boolean>
  >({});
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);

  // Derived step: 1=select file, 2=conflict list, 3=result
  const importStep = importResult ? 3 : importPreview ? 2 : 1;

  function toggleItem(item: ExportItem) {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  }

  async function handleExport() {
    const savePath = await save({
      defaultPath: "hermes-backup.zip",
      filters: [{ name: "Zip", extensions: ["zip"] }],
    });
    if (!savePath) return;

    setExporting(true);
    try {
      await Commands.exportData(
        Array.from(selectedItems),
        includeApiKeys,
        savePath
      );
      showToast(`${t("migrate.exportSuccess")}: ${savePath}`, "success");
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
      showToast(`${t("migrate.exportFailed")}: ${msg}`, "error");
    } finally {
      setExporting(false);
    }
  }

  async function handleSelectFile() {
    const path = await open({
      filters: [{ name: "Zip", extensions: ["zip"] }],
    });
    if (!path || typeof path !== "string") return;

    setZipPath(path);
    setPreviewing(true);
    try {
      const files = await Commands.previewImport(path);
      setImportPreview(files);
      const selections: Record<string, boolean> = {};
      for (const f of files) selections[f.path] = true;
      setFileSelections(selections);
    } catch {
      showToast(t("migrate.invalidZip"), "error");
      setZipPath(null);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleImport() {
    if (!zipPath || !importPreview) return;
    const selected = Object.entries(fileSelections)
      .filter(([, v]) => v)
      .map(([k]) => k);

    setImporting(true);
    try {
      const result = await Commands.executeImport(zipPath, selected);
      setImportResult(result);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
      showToast(`${t("migrate.importFailed")}: ${msg}`, "error");
    } finally {
      setImporting(false);
    }
  }

  function handleImportAgain() {
    setZipPath(null);
    setImportPreview(null);
    setFileSelections({});
    setImportResult(null);
  }

  function selectAll() {
    const next: Record<string, boolean> = {};
    for (const f of importPreview ?? []) next[f.path] = true;
    setFileSelections(next);
  }

  function deselectAll() {
    const next: Record<string, boolean> = {};
    for (const f of importPreview ?? []) next[f.path] = false;
    setFileSelections(next);
  }

  const conflictCount = importPreview?.filter((f) => f.hasConflict).length ?? 0;
  const selectedCount = Object.values(fileSelections).filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* Tab switcher */}
      <div className="bg-white rounded-[12px] p-1 shadow-[0_1px_4px_rgba(0,0,0,.06)] flex gap-1">
        {(["export", "import"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 text-[12px] font-[600] py-[7px] rounded-[9px] transition-colors ${
              activeTab === tab
                ? "bg-accent text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t(tab === "export" ? "migrate.exportTab" : "migrate.importTab")}
          </button>
        ))}
      </div>

      {/* Export tab */}
      {activeTab === "export" && (
        <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]">
          <div className="text-[10px] text-text-tertiary font-[600] tracking-[.3px] uppercase mb-3">
            {t("migrate.section")}
          </div>

          <div className="space-y-2 mb-4">
            {EXPORT_ITEMS.map((item) => (
              <label
                key={item}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedItems.has(item)}
                  onChange={() => toggleItem(item)}
                  className="accent-[var(--color-accent)]"
                />
                <span className="text-[12px] text-text-primary font-[500]">
                  {t(`migrate.items.${item}`)}
                </span>
              </label>
            ))}
          </div>

          <label className="flex items-center gap-2 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={includeApiKeys}
              onChange={(e) => setIncludeApiKeys(e.target.checked)}
              className="accent-[var(--color-accent)]"
            />
            <span className="text-[12px] text-text-secondary">
              {t("migrate.includeApiKeys")}
            </span>
          </label>

          <button
            onClick={handleExport}
            disabled={exporting || selectedItems.size === 0}
            className={`w-full text-[12px] font-[600] py-[9px] rounded-[9px] ${
              exporting || selectedItems.size === 0
                ? "bg-bg-secondary text-text-tertiary"
                : "bg-accent text-white"
            }`}
          >
            {exporting ? t("migrate.exporting") : t("migrate.export")}
          </button>
        </div>
      )}

      {/* Import tab */}
      {activeTab === "import" && (
        <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]">
          <div className="text-[10px] text-text-tertiary font-[600] tracking-[.3px] uppercase mb-3">
            {t("migrate.section")}
          </div>

          {/* Step 1: Select file */}
          {importStep === 1 && (
            <button
              onClick={handleSelectFile}
              disabled={previewing}
              className={`w-full text-[12px] font-[600] py-[9px] rounded-[9px] ${
                previewing
                  ? "bg-bg-secondary text-text-tertiary"
                  : "bg-accent text-white"
              }`}
            >
              {previewing ? t("migrate.previewing") : t("migrate.selectFile")}
            </button>
          )}

          {/* Step 2: Conflict resolution */}
          {importStep === 2 && importPreview && (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-text-secondary">
                  {conflictCount > 0
                    ? t("migrate.conflictsFound").replace(
                        "{count}",
                        String(conflictCount)
                      )
                    : t("migrate.noConflicts")}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="text-[11px] text-accent"
                  >
                    {t("migrate.selectAll")}
                  </button>
                  <button
                    onClick={deselectAll}
                    className="text-[11px] text-text-secondary"
                  >
                    {t("migrate.deselectAll")}
                  </button>
                </div>
              </div>

              <div className="space-y-1 mb-4 max-h-[200px] overflow-y-auto">
                {importPreview.map((file) => (
                  <label
                    key={file.path}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={fileSelections[file.path] ?? true}
                      onChange={(e) =>
                        setFileSelections((prev) => ({
                          ...prev,
                          [file.path]: e.target.checked,
                        }))
                      }
                      className="accent-[var(--color-accent)]"
                    />
                    <span className="text-[11px] font-mono text-text-primary flex-1 truncate">
                      {file.path}
                    </span>
                    {file.hasConflict && (
                      <span className="text-[10px] text-orange-500 shrink-0">
                        {t("migrate.hasConflict")}
                      </span>
                    )}
                  </label>
                ))}
              </div>

              <button
                onClick={handleImport}
                disabled={importing || selectedCount === 0}
                className={`w-full text-[12px] font-[600] py-[9px] rounded-[9px] ${
                  importing || selectedCount === 0
                    ? "bg-bg-secondary text-text-tertiary"
                    : "bg-accent text-white"
                }`}
              >
                {importing ? t("migrate.importing") : t("migrate.confirmImport")}
              </button>
            </>
          )}

          {/* Step 3: Result */}
          {importStep === 3 && importResult && (
            <>
              <div className="text-[13px] font-[600] text-text-primary mb-4">
                {t("migrate.importSuccess")
                  .replace("{imported}", String(importResult.imported))
                  .replace("{skipped}", String(importResult.skipped))}
              </div>
              <button
                onClick={handleImportAgain}
                className="w-full bg-bg-secondary text-text-primary text-[12px] font-[600] py-[9px] rounded-[9px]"
              >
                {t("migrate.importAgain")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
