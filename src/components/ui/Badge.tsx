type BadgeStatus = "green" | "yellow" | "red" | "accent" | "neutral";

const badgeClasses: Record<BadgeStatus, string> = {
  green:   "bg-status-green-bg  text-status-green",
  yellow:  "bg-status-yellow-bg text-status-yellow",
  red:     "bg-status-red-bg    text-status-red",
  accent:  "bg-accent-light     text-accent",
  neutral: "bg-bg-secondary     text-text-tertiary",
};

interface BadgeProps {
  status: BadgeStatus;
  children: React.ReactNode;
}

export function Badge({ status, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-[9px] py-[3px] rounded-[20px] text-[11px] font-[600] ${badgeClasses[status]}`}
    >
      {children}
    </span>
  );
}
