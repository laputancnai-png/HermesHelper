import { useEffect } from "react";
import { useUIStore } from "../../store";

export function Toast() {
  const { toast, clearToast } = useUIStore();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(clearToast, toast.type === "error" ? 5000 : 2800);
    return () => clearTimeout(timer);
  }, [toast, clearToast]);

  if (!toast) return null;

  const colorClass =
    toast.type === "success"
      ? "border-status-green/30 text-status-green"
      : toast.type === "error"
      ? "border-status-red/30 text-status-red"
      : "border-white/20 text-text-0";

  return (
    <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50
      bg-bg-2 border ${colorClass} rounded-md px-4 py-2
      text-[12px] font-ui shadow-lg`}>
      {toast.type === "success" && "✓ "}
      {toast.type === "error" && "✗ "}
      {toast.message}
    </div>
  );
}
