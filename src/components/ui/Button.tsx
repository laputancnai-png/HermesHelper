import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";
type Size = "md" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:   "bg-accent text-white hover:opacity-90",
  secondary: "bg-bg-window text-text-primary border border-bg-secondary hover:bg-bg-secondary",
  danger:    "bg-status-red-bg text-status-red border border-[#FFD0D0] hover:opacity-90",
};

const sizeClasses: Record<Size, string> = {
  md: "px-4 py-[7px] text-[13px] font-[500]",
  sm: "px-3 py-[5px] text-[12px] font-[500]",
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
      className={`rounded-[8px] transition-opacity duration-200
        disabled:opacity-40 disabled:cursor-not-allowed
        ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {loading ? "..." : children}
    </button>
  );
}
