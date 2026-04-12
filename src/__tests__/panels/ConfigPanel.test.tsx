import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConfigPanel } from "../../components/panels/ConfigPanel";
import { invoke } from "@tauri-apps/api/core";

const mockInvoke = invoke as ReturnType<typeof vi.fn>;

const defaultConfig = {
  provider: "openrouter",
  model: "anthropic/claude-sonnet-4-5",
  backend: "local",
  memoryLimitMb: 5120,
  persistentMemory: true,
  autoSkillGeneration: true,
  commandApproval: false,
  budgetWarning: true,
  language: "system",
};

beforeEach(() => {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === "get_config") return Promise.resolve(defaultConfig);
    return Promise.resolve();
  });
});

describe("ConfigPanel", () => {
  it("loads and displays config on mount", async () => {
    render(<ConfigPanel />);
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("get_config"));
  });

  it("shows save button", async () => {
    render(<ConfigPanel />);
    await waitFor(() => expect(screen.getByText("config.saveAll")).toBeInTheDocument());
  });

  it("calls save_config on save click", async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText("config.saveAll"));
    fireEvent.click(screen.getByText("config.saveAll"));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("save_config", expect.any(Object))
    );
  });
});
