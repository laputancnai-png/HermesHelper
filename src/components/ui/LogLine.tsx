type LogStatus = "ok" | "warn" | "fail" | "info" | "muted";

const prefixMap: Record<LogStatus, string> = {
  ok:   "✅",
  warn: "⚠️",
  fail: "❌",
  info: "→",
  muted: "",
};

interface LogLineProps {
  status: LogStatus;
  message: string;
  /** Show Apple-style row background (default true). Pass false for plain inline log text. */
  bg?: boolean;
}

export function LogLine({ status, message, bg = true }: LogLineProps) {
  const bgClass = bg
    ? status === "warn"
      ? "bg-status-yellow-bg rounded-[8px]"
      : "bg-bg-window rounded-[8px]"
    : "";
  const textClass =
    status === "info"  ? "text-accent" :
    status === "muted" ? "text-text-tertiary" :
    "text-text-primary";

  return (
    <div className={`flex items-center gap-2 px-3 py-[6px] text-[12px] font-mono ${bgClass} ${textClass}`}>
      {prefixMap[status] && <span>{prefixMap[status]}</span>}
      <span>{message}</span>
    </div>
  );
}
