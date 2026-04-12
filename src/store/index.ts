import { create } from "zustand";
import { createHermesSlice, HermesSlice } from "./hermesSlice";
import { createConfigSlice, ConfigSlice } from "./configSlice";
import { createUISlice, UISlice } from "./uiSlice";

export type { Panel } from "./uiSlice";

type Store = HermesSlice & ConfigSlice & UISlice;

export const useStore = create<Store>()((set) => ({
  ...createHermesSlice(set as Parameters<typeof createHermesSlice>[0]),
  ...createConfigSlice(set as Parameters<typeof createConfigSlice>[0]),
  ...createUISlice(set as Parameters<typeof createUISlice>[0]),
}));

// Convenience selectors
export const useHermesStore = () => useStore((s) => ({
  isInstalled: s.isInstalled,
  version: s.version,
  doctorResults: s.doctorResults,
  doctorRunning: s.doctorRunning,
  setInstalled: s.setInstalled,
  setDoctorResults: s.setDoctorResults,
  setDoctorRunning: s.setDoctorRunning,
}));

export const useConfigStore = () => useStore((s) => ({
  config: s.config,
  configLoaded: s.configLoaded,
  setConfig: s.setConfig,
  updateConfig: s.updateConfig,
  setConfigLoaded: s.setConfigLoaded,
}));

export const useUIStore = () => useStore((s) => ({
  activePanel: s.activePanel,
  toast: s.toast,
  setActivePanel: s.setActivePanel,
  showToast: s.showToast,
  clearToast: s.clearToast,
}));
