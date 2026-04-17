// src/App.tsx
import { LangProvider, useLang } from "./i18n";
import { useStore } from "./store";
import { theme as P } from "./theme";
import { HermesStatusPanel } from "./features/status/HermesStatusPanel";
import { InstallPanel } from "./features/install/InstallPanel";
import { ModelPanel } from "./features/model/ModelPanel";
import { MigratePanel } from "./features/migrate/MigratePanel";

const LANGS = [
  { code: "zh" as const, label: "中文", flag: "🇨🇳" },
  { code: "en" as const, label: "EN",   flag: "🇺🇸" },
];

function LangPicker() {
  const { lang, setLang } = useLang();
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {LANGS.map(l => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          style={{
            background: lang === l.code ? P.indigo : "transparent",
            color: lang === l.code ? "#fff" : P.soft,
            border: "none", borderRadius: 8,
            padding: "4px 10px", fontSize: 12, fontWeight: 700,
            cursor: "pointer", transition: "all 0.15s",
            display: "flex", alignItems: "center", gap: 4,
          }}
        >
          <span>{l.flag}</span>
          <span>{l.label}</span>
        </button>
      ))}
    </div>
  );
}

function Toast() {
  const { toast, clearToast } = useStore();
  if (!toast) return null;
  const colors = {
    success: { bg: P.banner.success.bg, border: P.banner.success.border, text: P.banner.success.text },
    error:   { bg: P.banner.error.bg,   border: P.banner.error.border,   text: P.banner.error.text   },
    info:    { bg: "#EEF0FF", border: P.indigo, text: P.indigo },
  }[toast.type];
  return (
    <div
      className="pop"
      onClick={clearToast}
      style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 9999,
        background: colors.bg, border: `2px solid ${colors.border}`,
        color: colors.text, borderRadius: P.radius.md,
        padding: "12px 20px", fontSize: 13, fontWeight: 700,
        boxShadow: P.shadow.heavy, cursor: "pointer", maxWidth: 360,
      }}
    >
      {toast.message}
    </div>
  );
}

function AppInner() {
  const { t } = useLang();

  return (
    <div style={{ minHeight: "100vh", background: P.bg, fontFamily: "Nunito,sans-serif" }}>
      {/* Sticky Navbar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        height: P.nav.height,
        background: P.nav.bg,
        borderBottom: `1.5px solid ${P.nav.border}`,
        display: "flex", alignItems: "center",
        padding: "0 24px",
        boxShadow: "0 2px 8px rgba(91,95,239,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
          <span style={{ fontSize: 26 }}>🤖</span>
          <span style={{ fontFamily: "Fredoka One,cursive", fontSize: 18, color: P.ink }}>
            {t.app.brand}
          </span>
        </div>
        <LangPicker />
      </div>

      {/* Main content */}
      <main style={{ maxWidth: 880, margin: "28px auto 0", padding: "0 20px 40px" }}>
        <HermesStatusPanel />
        <InstallPanel />
        <ModelPanel />
        <MigratePanel />
      </main>

      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <LangProvider>
      <AppInner />
    </LangProvider>
  );
}
