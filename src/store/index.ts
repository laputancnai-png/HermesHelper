// Minimal stub — replaced by full Zustand store in Task 6
import { useState, useCallback } from "react";

export type Panel = "home" | "install" | "config" | "tools" | "gateway" | "migrate";

export interface Toast {
  message: string;
  type: "success" | "error" | "info";
}

// Module-level state (stub only — Task 6 replaces with Zustand)
let _toast: Toast | null = null;
const _listeners: Set<() => void> = new Set();

function notify() { _listeners.forEach(fn => fn()); }

export function useUIStore() {
  const [, rerender] = useState(0);
  const listen = useCallback(() => { _listeners.add(() => rerender(n => n + 1)); }, []);
  // Register listener on first call
  if (!_listeners.size) listen();

  return {
    activePanel: "home" as Panel,
    toast: _toast,
    setActivePanel: (_panel: Panel) => {},
    showToast: (message: string, type: Toast["type"] = "info") => {
      _toast = { message, type };
      notify();
    },
    clearToast: () => {
      _toast = null;
      notify();
    },
  };
}
