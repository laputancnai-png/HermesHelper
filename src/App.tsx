// src/App.tsx
import { useState } from "react";
import { LangProvider, useLang } from "./i18n";
import { useStore } from "./store";
import { theme as P } from "./theme";
import { HermesStatusPanel } from "./features/status/HermesStatusPanel";
import { InstallPanel } from "./features/install/InstallPanel";
import { ModelPanel } from "./features/model/ModelPanel";
import { MigratePanel } from "./features/migrate/MigratePanel";
import { ChatPage } from "./features/chat/ChatPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";

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
  const [page, setPage] = useState<"manage" | "chat" | "dashboard">("manage");

  const NAV_TABS = [
    { id: "manage"    as const, label: t.nav.manage,    emoji: "🤖" },
    { id: "chat"      as const, label: t.nav.chat,      emoji: ""   },
    { id: "dashboard" as const, label: t.nav.dashboard, emoji: ""   },
  ];

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
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 16, flexShrink: 0 }}>
          <span style={{ fontSize: 26 }}>🤖</span>
          <span style={{ fontFamily: "Fredoka One,cursive", fontSize: 18, color: P.ink }}>
            {t.app.brand}
          </span>
        </div>

        {/* Tab nav */}
        <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
          {NAV_TABS.map(tab => {
            const active = page === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setPage(tab.id)}
                style={{
                  background: "transparent",
                  color: active ? P.indigo : P.soft,
                  border: "none",
                  borderBottom: active ? `3px solid ${P.indigo}` : "3px solid transparent",
                  borderTop: "3px solid transparent",
                  padding: "0 16px",
                  height: P.nav.height,
                  fontSize: 13, fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "Nunito,sans-serif",
                  transition: "color 0.12s",
                  whiteSpace: "nowrap",
                  display: "flex", alignItems: "center", gap: 5,
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = P.ink; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = P.soft; }}
              >
                {tab.id === "manage" && <span>{tab.emoji}</span>}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <LangPicker />
      </div>

      {/* Main content */}
      {page !== "dashboard" && (
        <main style={{ maxWidth: 880, margin: "28px auto 0", padding: "0 20px 40px" }}>
          {page === "manage" && (
            <>
              <HermesStatusPanel />
              <InstallPanel />
              <ModelPanel />
              <MigratePanel />
            </>
          )}
          {page === "chat" && <ChatPage />}
        </main>
      )}
      {page === "dashboard" && <DashboardPage />}

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
