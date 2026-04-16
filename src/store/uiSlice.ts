export type Panel = "home" | "install" | "config" | "tools" | "gateway" | "migrate";

export interface Toast {
  message: string;
  type: "success" | "error" | "info";
}

export interface UISlice {
  activePanel: Panel;
  toast: Toast | null;
  setActivePanel: (panel: Panel) => void;
  showToast: (message: string, type?: Toast["type"]) => void;
  clearToast: () => void;
}

export const createUISlice = (set: (fn: (s: UISlice) => Partial<UISlice>) => void): UISlice => ({
  activePanel: "home",
  toast: null,
  setActivePanel: (panel) => set(() => ({ activePanel: panel })),
  showToast: (message, type = "info") => set(() => ({ toast: { message, type } })),
  clearToast: () => set(() => ({ toast: null })),
});
