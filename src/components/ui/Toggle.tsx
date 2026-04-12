interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ label, description, checked, onChange, disabled }: ToggleProps) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer group">
      <div>
        <span className="text-text-0 text-[13px]">{label}</span>
        {description && (
          <p className="text-text-1 text-[11px] mt-0.5">{description}</p>
        )}
      </div>
      <div className="relative flex-shrink-0">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div
          className={`w-10 h-5 rounded-full transition-colors duration-[140ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
            checked ? "bg-cyan/20 border border-cyan/40" : "bg-bg-4 border border-white/10"
          } ${disabled ? "opacity-40" : ""}`}
        >
          <div
            className={`absolute top-[3px] w-[14px] h-[14px] rounded-full transition-all duration-[140ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
              checked
                ? "left-[22px] bg-cyan shadow-[0_0_8px_rgba(0,212,255,0.5)]"
                : "left-[3px] bg-text-1"
            }`}
          />
        </div>
      </div>
    </label>
  );
}
