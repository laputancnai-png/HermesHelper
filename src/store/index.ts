// src/store/index.ts
import { create } from "zustand";

export interface HermesConfig {
  provider: string;
  model: string;
  memoryLimitMb: number;
  persistentMemory: boolean;
  autoSkillGeneration: boolean;
  commandApproval: boolean;
  budgetWarning: boolean;
  language: string;
}

export interface Toast {
  message: string;
  type: "success" | "error" | "info";
}

interface Store {
  // Status
  installed: boolean;
  version: string | null;
  running: boolean;
  setStatus: (installed: boolean, version: string | null, running: boolean) => void;

  // Config
  config: HermesConfig;
  setConfig: (c: HermesConfig) => void;

  // Toast
  toast: Toast | null;
  showToast: (message: string, type?: Toast["type"]) => void;
  clearToast: () => void;
}

const DEFAULT_CONFIG: HermesConfig = {
  provider: "openrouter",
  model: "anthropic/claude-sonnet-4-5",
  memoryLimitMb: 5120,
  persistentMemory: true,
  autoSkillGeneration: true,
  commandApproval: false,
  budgetWarning: true,
  language: "system",
};

export const useStore = create<Store>((set) => ({
  installed: false,
  version: null,
  running: false,
  setStatus: (installed, version, running) => set({ installed, version, running }),

  config: DEFAULT_CONFIG,
  setConfig: (config) => set({ config }),

  toast: null,
  showToast: (message, type = "info") => {
    set({ toast: { message, type } });
    setTimeout(() => set({ toast: null }), 3500);
  },
  clearToast: () => set({ toast: null }),
}));
