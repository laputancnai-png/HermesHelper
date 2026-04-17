// src/theme.ts — design tokens (mirrors OpenClawHelper theme.js)
export const P = {
  bg:     "#F4F6FF",
  white:  "#FFFFFF",
  ink:    "#1F1F30",
  soft:   "#7878A0",
  border: "#E4E4F4",

  indigo: "#5B5FEF",
  teal:   "#18B989",
  coral:  "#FF6B4A",
  amber:  "#F59E0B",

  radius: { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 },

  shadow: {
    card:   "0 2px 12px rgba(91,95,239,0.08)",
    panel:  "0 4px 18px rgba(0,0,0,0.06)",
    heavy:  "0 8px 40px rgba(0,0,0,0.10)",
    btn:    (c: string) => `0 3px 10px ${c}33`,
    btnHov: (c: string) => `0 6px 20px ${c}66`,
  },

  nav: { height: 56, bg: "#FFFFFF", border: "#EBEBF8" },

  banner: {
    success: { bg: "#EAFAF3", border: "#A8EDD0", text: "#1A6A4A" },
    warning: { bg: "#FFFBE8", border: "#FFE066", text: "#8A6A00" },
    error:   { bg: "#FFF0EE", border: "#FFB8A8", text: "#8B2020" },
  },
} as const;
