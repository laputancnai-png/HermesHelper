export function Topbar() {
  return (
    <div className="flex items-center h-11 px-4 relative select-none">
      <div className="flex items-center gap-[7px]">
        <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
        <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
        <div className="w-3 h-3 rounded-full bg-[#28C840]" />
      </div>
      <span className="absolute left-1/2 -translate-x-1/2 text-[13px] font-[600] text-text-primary">
        Hermes Manager
      </span>
    </div>
  );
}
