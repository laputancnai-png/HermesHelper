import "@testing-library/jest-dom/vitest";

// Mock @tauri-apps/api so tests don't need a real Tauri process
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));
