type LogStatus = "ok" | "warn" | "fail" | "info" | "muted";

const lineClasses: Record<LogStatus, string> = {
  ok: "text-status-green",
  warn: "text-status-yellow",
  fail: "text-status-red",
  info: "text-status-blue",
  muted: "text-text-2",
};

const prefixes: Record<LogStatus, string> = {
  ok: "✓ ",
  warn: "⚠ ",
  fail: "✗ ",
  info: "ℹ ",
  muted: "",
};

interface LogLineProps {
  status: LogStatus;
  timestamp?: string;
  message: string;
}

export function LogLine({ status, timestamp, message }: LogLineProps) {
  return (
    <div className={`flex gap-3 text-[11px] font-mono leading-6 ${lineClasses[status]}`}>
      {timestamp && <span className="text-text-2 flex-shrink-0">{timestamp}</span>}
      <span>{prefixes[status]}{message}</span>
    </div>
  );
}
