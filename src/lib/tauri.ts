import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen, UnlistenFn } from "@tauri-apps/api/event";

// ── Domain types ──────────────────────────────────────────────

export interface PlatformInfo {
  os: "macos" | "windows" | "linux";
  arch: string;
  osVersion: string;
}

export interface HermesConfig {
  provider: string;
  model: string;
  backend: "local" | "docker" | "ssh" | "modal";
  memoryLimitMb: number;
  persistentMemory: boolean;
  autoSkillGeneration: boolean;
  commandApproval: boolean;
  budgetWarning: boolean;
  language: string; // "system" | "zh" | "en"
}

export interface DoctorResult {
  status: "ok" | "warn" | "fail";
  message: string;
}

export interface InstallProgress {
  line: string;
  pct: number;
}

export type ToolId =
  | "terminal"
  | "file"
  | "web"
  | "memory"
  | "skills"
  | "todo"
  | "cronjob"
  | "browser"
  | "vision"
  | "image_gen"
  | "tts"
  | "moa";

export interface HermesStatus {
  installed: boolean;
  version: string | null;
  running: boolean;
}

export interface GatewayConfig {
  botToken: string;
  allowedUsers: string;
}

export interface GatewayStatus {
  running: boolean;
}

export interface ImportFileInfo {
  path: string;
  category: string;
  hasConflict: boolean;
}

export interface ImportSummary {
  imported: number;
  skipped: number;
}

export interface ChatReply {
  reply: string;
  sessionId: string;
}

// ── Commands ──────────────────────────────────────────────────

export const Commands = {
  getHermesStatus: (): Promise<HermesStatus> =>
    tauriInvoke("get_hermes_status"),

  detectPlatform: (): Promise<PlatformInfo> =>
    tauriInvoke("detect_platform"),

  checkHermesVersion: (): Promise<string | null> =>
    tauriInvoke("check_hermes_version"),

  installHermes: (): Promise<void> =>
    tauriInvoke("install_hermes"),

  uninstallHermes: (): Promise<void> =>
    tauriInvoke("uninstall_hermes"),

  getConfig: (): Promise<HermesConfig> =>
    tauriInvoke("get_config"),

  saveConfig: (config: HermesConfig): Promise<void> =>
    tauriInvoke("save_config", { config }),

  saveApiKey: (provider: string, key: string): Promise<void> =>
    tauriInvoke("save_api_key", { provider, key }),

  applyProviderYamlPatch: (patchYaml: string): Promise<void> =>
    tauriInvoke("apply_provider_yaml_patch", { patchYaml }),

  testApiConnection: (provider: string, key: string): Promise<boolean> =>
    tauriInvoke("test_api_connection", { provider, key }),

  runDoctor: (): Promise<DoctorResult[]> =>
    tauriInvoke("run_doctor"),

  getRecentActivity: (): Promise<string[]> =>
    tauriInvoke("get_recent_activity"),

  getSystemLocale: (): Promise<string> =>
    tauriInvoke("get_system_locale"),

  getTools: (): Promise<ToolId[]> =>
    tauriInvoke("get_tools"),

  saveTools: (toolsets: ToolId[]): Promise<void> =>
    tauriInvoke("save_tools", { toolsets }),

  getGatewayConfig: (): Promise<GatewayConfig> =>
    tauriInvoke("get_gateway_config"),

  saveGatewayConfig: (botToken: string, allowedUsers: string): Promise<void> =>
    tauriInvoke("save_gateway_config", { botToken, allowedUsers }),

  getGatewayStatus: (): Promise<GatewayStatus> =>
    tauriInvoke("get_gateway_status"),

  startGateway: (): Promise<void> =>
    tauriInvoke("start_gateway"),

  stopGateway: (): Promise<void> =>
    tauriInvoke("stop_gateway"),

  exportData: (items: string[], includeApiKeys: boolean, savePath: string): Promise<void> =>
    tauriInvoke("export_data", { items, includeApiKeys, savePath }),

  previewImport: (zipPath: string): Promise<ImportFileInfo[]> =>
    tauriInvoke("preview_import", { zipPath }),

  executeImport: (zipPath: string, selectedFiles: string[]): Promise<ImportSummary> =>
    tauriInvoke("execute_import", { zipPath, selectedFiles }),

  hermesChat: (message: string, sessionId?: string): Promise<ChatReply> =>
    tauriInvoke("hermes_chat", { message, sessionId: sessionId ?? null }),

  checkDashboardReady: (): Promise<boolean> =>
    tauriInvoke("check_dashboard_ready"),
};

// ── Events ────────────────────────────────────────────────────

export const Events = {
  onInstallProgress: (
    handler: (progress: InstallProgress) => void
  ): Promise<UnlistenFn> =>
    tauriListen<InstallProgress>("install_progress", (e) => handler(e.payload)),

  onInstallDone: (handler: () => void): Promise<UnlistenFn> =>
    tauriListen("install_done", () => handler()),

  onInstallError: (handler: (msg: string) => void): Promise<UnlistenFn> =>
    tauriListen<string>("install_error", (e) => handler(e.payload)),
};
