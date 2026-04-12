import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    typecheck: {
      tsconfig: "./tsconfig.test.json",
    },
  },
  clearScreen: false,
  server: { port: 1420, strictPort: true },
});
