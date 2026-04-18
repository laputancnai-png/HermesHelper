// src/i18n.tsx — lightweight zh/en i18n (replaces react-i18next)
import { createContext, useContext, useState, ReactNode } from "react";

const ZH = {
  app: { brand: "Hermes Manager", tagline: "Hermes AI 助手管理器" },
  nav: { lang: "语言", manage: "管理", chat: "💬 聊天" },
  status: {
    installed: "已安装", notInstalled: "未安装",
    running: "运行中", stopped: "已停止",
    version: "版本", detecting: "检测中...",
    gatewayConnected: "Gateway 已连接", gatewayOffline: "Gateway 离线",
  },
  install: {
    title: "安装 / 更新",
    desc: "自动下载并安装 Hermes Agent（通常需要 3–10 分钟）",
    start: "开始安装", reinstall: "重新安装",
    update: "检查更新", uninstall: "卸载",
    uninstallConfirm: "确认卸载 Hermes？此操作将删除 ~/.hermes 目录及所有数据。",
    uninstallClean: "同时删除所有数据（~/.hermes）",
    progress: "安装进度", waiting: "正在启动安装程序...",
    done: "安装完成", failed: "安装失败",
    cancelBtn: "取消", clearBtn: "清除日志",
    installing: "安装中",
  },
  model: {
    title: "模型配置",
    desc: "配置 AI 提供商和模型",
    provider: "提供商", model: "模型", apiKey: "API 密钥",
    showKey: "显示", hideKey: "隐藏",
    testConn: "测试连接", save: "保存配置",
    connOk: "✅ 连接成功", connFail: "❌ 连接失败",
    saved: "配置已保存", saveFailed: "保存失败",
    placeholder: "sk-or-v1-...",
  },
  migrate: {
    title: "数据迁移",
    desc: "导出或导入 Hermes 配置与数据",
    export: "导出数据", import: "导入数据",
    importing: "导入中...",
    exportOk: "✅ 导出成功", exportFailed: "❌ 导出失败",
    importOk: "✅ 导入成功", importFailed: "❌ 导入失败",
    importConfirm: "导入会覆盖现有配置，确认继续？",
    selectFile: "选择 .zip 文件",
  },
  toast: {
    installSuccess: "安装成功！", installFailed: "安装失败",
    uninstallSuccess: "卸载成功", uninstallFailed: "卸载失败",
  },
  chat: {
    title: "Hermes 聊天",
    subtitle: "与 Hermes AI 助手直接对话",
    send: "发送",
    sending: "发送中",
    placeholder: "输入消息… (Cmd+Enter 发送)",
    newSession: "新对话",
    sessionLabel: "会话",
    thinking: "Hermes 思考中…",
    empty: "发消息开始与 Hermes 对话",
    error: "发送失败",
    cleared: "已开始新对话",
  },
};

const EN: typeof ZH = {
  app: { brand: "Hermes Manager", tagline: "Hermes AI Agent Manager" },
  nav: { lang: "Language", manage: "Manage", chat: "💬 Chat" },
  status: {
    installed: "Installed", notInstalled: "Not Installed",
    running: "Running", stopped: "Stopped",
    version: "Version", detecting: "Detecting...",
    gatewayConnected: "Gateway Connected", gatewayOffline: "Gateway Offline",
  },
  install: {
    title: "Install / Update",
    desc: "Auto-download and install Hermes Agent (usually 3–10 minutes)",
    start: "Start Install", reinstall: "Reinstall",
    update: "Check Update", uninstall: "Uninstall",
    uninstallConfirm: "Uninstall Hermes? This will delete ~/.hermes and all data.",
    uninstallClean: "Also delete all data (~/.hermes)",
    progress: "Install Progress", waiting: "Starting installer...",
    done: "Install Complete", failed: "Install Failed",
    cancelBtn: "Cancel", clearBtn: "Clear Logs",
    installing: "Installing",
  },
  model: {
    title: "Model Config",
    desc: "Configure AI provider and model",
    provider: "Provider", model: "Model", apiKey: "API Key",
    showKey: "Show", hideKey: "Hide",
    testConn: "Test Connection", save: "Save Config",
    connOk: "✅ Connection OK", connFail: "❌ Connection Failed",
    saved: "Config saved", saveFailed: "Save failed",
    placeholder: "sk-or-v1-...",
  },
  migrate: {
    title: "Data Migration",
    desc: "Export or import Hermes configuration and data",
    export: "Export Data", import: "Import Data",
    importing: "Importing...",
    exportOk: "✅ Export successful", exportFailed: "❌ Export failed",
    importOk: "✅ Import successful", importFailed: "❌ Import failed",
    importConfirm: "Import will overwrite existing config. Continue?",
    selectFile: "Select .zip file",
  },
  toast: {
    installSuccess: "Install successful!", installFailed: "Install failed",
    uninstallSuccess: "Uninstall successful", uninstallFailed: "Uninstall failed",
  },
  chat: {
    title: "Hermes Chat",
    subtitle: "Chat directly with your Hermes AI agent",
    send: "Send",
    sending: "Sending",
    placeholder: "Type a message… (Cmd+Enter to send)",
    newSession: "New Chat",
    sessionLabel: "Session",
    thinking: "Hermes is thinking…",
    empty: "Send a message to start chatting with Hermes",
    error: "Send failed",
    cleared: "New conversation started",
  },
};

const TRANSLATIONS = { zh: ZH, en: EN } as const;
type Lang = keyof typeof TRANSLATIONS;

const LS_KEY = "hermes-manager.lang.v1";
function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved === "zh" || saved === "en") return saved;
  } catch {}
  return navigator.language.startsWith("zh") ? "zh" : "en";
}

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: typeof ZH;
}

const Ctx = createContext<LangCtx>({ lang: "zh", setLang: () => {}, t: ZH });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);
  function setLang(l: Lang) {
    setLangState(l);
    try { localStorage.setItem(LS_KEY, l); } catch {}
  }
  return <Ctx.Provider value={{ lang, setLang, t: TRANSLATIONS[lang] }}>{children}</Ctx.Provider>;
}

export function useLang() {
  return useContext(Ctx);
}
