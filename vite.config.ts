import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(async () => ({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    exclude: ["**/node_modules/**", "**/.worktrees/**"],
    typecheck: {
      tsconfig: "./tsconfig.test.json",
    },
  },
  clearScreen: false,
  server: { port: 1420, strictPort: true, host: false },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? true : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
}));
