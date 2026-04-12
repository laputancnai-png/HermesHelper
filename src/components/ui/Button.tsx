import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";
type Size = "md" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-status-blue/10 text-status-blue border border-status-blue/30 hover:bg-status-blue/20",
  secondary: "bg-bg-4 text-text-0 border border-white/10 hover:bg-bg-3",
  danger: "bg-status-red/10 text-status-red border border-status-red/30 hover:bg-status-red/20",
};

const sizeClasses: Record<Size, string> = {
  md: "px-4 py-2 text-[12px]",
  sm: "px-3 py-1.5 text-[11px]",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  disabled,
  children,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`rounded-md font-ui transition-colors duration-[140ms] ease-[cubic-bezier(0.4,0,0.2,1)]
        disabled:opacity-40 disabled:cursor-not-allowed
        ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {loading ? "…" : children}
    </button>
  );
}
