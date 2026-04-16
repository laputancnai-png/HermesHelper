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

  const sidebarColor =
    toast.type === "success" ? "bg-status-green" :
    toast.type === "error"   ? "bg-status-red" :
    "bg-accent";

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 animate-fade-in
      flex items-stretch bg-white rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,.12)] overflow-hidden">
      <div className={`w-[3px] ${sidebarColor}`} />
      <div className="px-4 py-[10px] text-[13px] text-text-primary">
        {toast.message}
      </div>
    </div>
  );
}
