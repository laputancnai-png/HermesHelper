import { create } from "zustand";
import { useShallow } from "zustand/shallow";
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

// Convenience selectors — useShallow prevents new-object-reference re-renders
export const useHermesStore = () => useStore(useShallow((s) => ({
  isInstalled: s.isInstalled,
  version: s.version,
  doctorResults: s.doctorResults,
  doctorRunning: s.doctorRunning,
  setInstalled: s.setInstalled,
  setDoctorResults: s.setDoctorResults,
  setDoctorRunning: s.setDoctorRunning,
})));

export const useConfigStore = () => useStore(useShallow((s) => ({
  config: s.config,
  configLoaded: s.configLoaded,
  setConfig: s.setConfig,
  updateConfig: s.updateConfig,
  setConfigLoaded: s.setConfigLoaded,
})));

export const useUIStore = () => useStore(useShallow((s) => ({
  activePanel: s.activePanel,
  toast: s.toast,
  setActivePanel: s.setActivePanel,
  showToast: s.showToast,
  clearToast: s.clearToast,
})));
