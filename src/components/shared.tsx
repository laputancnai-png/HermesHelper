// src/components/shared.tsx — Btn + Pill primitives
import { useState } from "react";
import { theme as P, shadowBtn, shadowBtnHov } from "../theme";

interface PillProps {
  bg: string;
  border: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function Pill({ bg, border, children, style }: PillProps) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: bg, border: `2px solid ${border}`,
      borderRadius: 20, padding: "3px 12px",
      fontSize: 13, fontWeight: 700, color: P.ink, ...style,
    }}>
      {children}
    </span>
  );
}

interface BtnProps {
  children: React.ReactNode;
  onClick?: () => void;
  color?: string;
  ghost?: boolean;
  small?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: React.CSSProperties;
  type?: "button" | "submit";
}

export function Btn({ children, onClick, color = P.indigo, ghost, small, disabled, loading, style, type = "button" }: BtnProps) {
  const [hov, setHov] = useState(false);
  const isDisabled = disabled || loading;

  if (ghost) {
    return (
      <button
        type={type}
        onClick={onClick}
        disabled={isDisabled}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          background: hov ? "#F0F0F8" : P.white,
          color: P.soft,
          border: "2px solid #E0E0F0",
          borderRadius: 14,
          padding: small ? "6px 14px" : "11px 24px",
          fontSize: small ? 12 : 14,
          fontWeight: 700,
          cursor: isDisabled ? "default" : "pointer",
          transition: "all 0.15s",
          opacity: isDisabled ? 0.6 : 1,
          ...style,
        }}
      >
        {loading ? <span className="spin">⚙️</span> : children}
      </button>
    );
  }

  return (
    <button
      type={type}
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: isDisabled ? "#D0D0E0" : color,
        color: "#fff",
        border: "none",
        borderRadius: 16,
        padding: small ? "8px 18px" : "13px 28px",
        fontSize: small ? 13 : 15,
        fontWeight: 800,
        cursor: isDisabled ? "default" : "pointer",
        boxShadow: hov && !isDisabled ? shadowBtnHov(color) : shadowBtn(color),
        transform: hov && !isDisabled ? "translateY(-2px)" : "none",
        transition: "all 0.18s ease",
        opacity: isDisabled ? 0.7 : 1,
        display: "inline-flex", alignItems: "center", gap: 6,
        ...style,
      }}
    >
      {loading ? <><span className="spin" style={{ fontSize: small ? 12 : 14 }}>⚙️</span> {children}</> : children}
    </button>
  );
}
