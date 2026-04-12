import { HermesConfig } from "../lib/tauri";

const DEFAULT_CONFIG: HermesConfig = {
  provider: "openrouter",
  model: "anthropic/claude-sonnet-4-5",
  backend: "local",
  memoryLimitMb: 5120,
  persistentMemory: true,
  autoSkillGeneration: true,
  commandApproval: false,
  budgetWarning: true,
};

export interface ConfigSlice {
  config: HermesConfig;
  configLoaded: boolean;
  setConfig: (config: HermesConfig) => void;
  updateConfig: (patch: Partial<HermesConfig>) => void;
  setConfigLoaded: (loaded: boolean) => void;
}

export const createConfigSlice = (set: (fn: (s: ConfigSlice) => Partial<ConfigSlice>) => void): ConfigSlice => ({
  config: DEFAULT_CONFIG,
  configLoaded: false,
  setConfig: (config) => set(() => ({ config, configLoaded: true })),
  updateConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
  setConfigLoaded: (loaded) => set(() => ({ configLoaded: loaded })),
});
