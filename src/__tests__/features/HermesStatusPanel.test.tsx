import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HermesStatusPanel } from "../../features/status/HermesStatusPanel";
import { LangProvider } from "../../i18n";

vi.mock("../../lib/tauri", () => ({
  Commands: {
    getHermesStatus: vi.fn().mockResolvedValue({
      installed: true, version: "v0.10.0", running: false,
    }),
  },
}));

vi.mock("../../store", () => ({
  useStore: () => ({
    installed: false, version: null, running: false,
    setStatus: vi.fn(),
  }),
}));

describe("HermesStatusPanel", () => {
  it("renders Hermes Agent heading", () => {
    render(<LangProvider><HermesStatusPanel /></LangProvider>);
    expect(screen.getByText("Hermes Agent")).toBeInTheDocument();
  });
});
