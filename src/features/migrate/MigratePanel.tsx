// src/features/migrate/MigratePanel.tsx
import { useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { theme as P } from "../../theme";
import { Btn } from "../../components/shared";
import { Commands } from "../../lib/tauri";
import { useLang } from "../../i18n";

export function MigratePanel() {
  const { t } = useLang();
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleExport() {
    setMsg("");
    try {
      const savePath = await save({
        title: "选择导出位置",
        filters: [{ name: "ZIP", extensions: ["zip"] }],
        defaultPath: `hermes-backup-${new Date().toISOString().slice(0,10)}.zip`,
      });
      if (!savePath) return;
      await Commands.exportData(["all"], true, savePath);
      setMsg(t.migrate.exportOk);
    } catch (e) {
      setMsg(`${t.migrate.exportFailed}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function handleImport() {
    if (!confirm(t.migrate.importConfirm)) return;
    setImporting(true);
    setMsg(t.migrate.importing);
    try {
      const zipPath = await open({
        title: "选择备份文件",
        filters: [{ name: "ZIP", extensions: ["zip"] }],
        multiple: false,
      });
      if (!zipPath) { setImporting(false); setMsg(""); return; }
      const preview = await Commands.previewImport(zipPath as string);
      const files = preview.map(f => f.path);
      const result = await Commands.executeImport(zipPath as string, files);
      setMsg(`${t.migrate.importOk} (${result.imported} 个文件)`);
    } catch (e) {
      setMsg(`${t.migrate.importFailed}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={{
      background: P.white, borderRadius: P.radius.xl,
      padding: "20px 24px", marginBottom: 12,
      boxShadow: P.shadow.panel, border: `2px solid ${P.border}`,
    }}>
      <div style={{ fontFamily: "Fredoka One,cursive", fontSize: 18, color: P.ink, marginBottom: 4 }}>
        {t.migrate.title}
      </div>
      <div style={{ fontSize: 12, color: P.soft, marginBottom: 16 }}>{t.migrate.desc}</div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Btn color={P.indigo} onClick={handleExport} small>
          📦 {t.migrate.export}
        </Btn>
        <Btn color={P.teal} onClick={handleImport} small loading={importing} disabled={importing}>
          📥 {importing ? t.migrate.importing : t.migrate.import}
        </Btn>
      </div>

      {msg && (
        <div style={{
          marginTop: 12, fontSize: 12, fontWeight: 700,
          color: /(ok|成功)/i.test(msg) ? P.teal : importing ? P.soft : P.coral,
        }}>
          {msg}
        </div>
      )}
    </div>
  );
}
