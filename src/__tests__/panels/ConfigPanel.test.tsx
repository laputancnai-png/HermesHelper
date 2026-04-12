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
    await waitFor(() => expect(screen.getByText("保存所有配置")).toBeInTheDocument());
  });

  it("calls save_config on save click", async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText("保存所有配置"));
    fireEvent.click(screen.getByText("保存所有配置"));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("save_config", expect.any(Object))
    );
  });
});
