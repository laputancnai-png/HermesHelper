type BadgeStatus = "green" | "yellow" | "red" | "grey" | "blue";

const badgeClasses: Record<BadgeStatus, string> = {
  green: "bg-status-green/10 text-status-green border-status-green/30",
  yellow: "bg-status-yellow/10 text-status-yellow border-status-yellow/30",
  red: "bg-status-red/10 text-status-red border-status-red/30",
  grey: "bg-bg-4 text-text-1 border-white/10",
  blue: "bg-status-blue/10 text-status-blue border-status-blue/30",
};

interface BadgeProps {
  status: BadgeStatus;
  children: React.ReactNode;
}

export function Badge({ status, children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] border ${badgeClasses[status]}`}>
      {children}
    </span>
  );
}
