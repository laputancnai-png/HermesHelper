interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ label, description, checked, onChange, disabled }: ToggleProps) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <div>
        <span className="text-text-primary text-[13px]">{label}</span>
        {description && (
          <p className="text-text-placeholder text-[11px] mt-[2px]">{description}</p>
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
        {/* Track */}
        <div
          className={`w-[51px] h-[31px] rounded-[16px] transition-colors duration-200 ${
            checked ? "bg-accent" : "bg-bg-secondary"
          } ${disabled ? "opacity-40" : ""}`}
        >
          {/* Thumb */}
          <div
            className={`absolute top-[2px] w-[27px] h-[27px] rounded-full bg-white transition-all duration-200 shadow-[0_1px_3px_rgba(0,0,0,.2)] ${
              checked ? "right-[2px]" : "left-[2px]"
            }`}
          />
        </div>
      </div>
    </label>
  );
}
