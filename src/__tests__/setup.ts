import "@testing-library/jest-dom/vitest";

// Mock @tauri-apps/api so tests don't need a real Tauri process
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

// Mock react-i18next — t(key) returns key so tests can assert on translation keys
vi.mock("react-i18next", () => ({
  useTranslation: vi.fn(() => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn().mockResolvedValue(undefined), language: "zh" },
  })),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

// Mock src/lib/i18n to prevent real i18next initialization in tests
vi.mock("../lib/i18n", () => ({
  initI18n: vi.fn(),
  i18n: { changeLanguage: vi.fn().mockResolvedValue(undefined) },
}));
