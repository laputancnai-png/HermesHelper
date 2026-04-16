import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToolsPanel } from "../../components/panels/ToolsPanel";
import { invoke } from "@tauri-apps/api/core";

const mockInvoke = invoke as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === "get_tools")
      return Promise.resolve(["terminal", "file", "web", "memory", "skills", "todo", "cronjob",
        "browser", "vision", "image_gen", "tts", "moa"]);
    if (cmd === "save_tools") return Promise.resolve();
    return Promise.resolve();
  });
});

describe("ToolsPanel", () => {
  it("renders core tools section header", async () => {
    render(<ToolsPanel />);
    await waitFor(() =>
      expect(screen.getByText("tools.coreSection")).toBeInTheDocument()
    );
  });

  it("renders optional tools section header", async () => {
    render(<ToolsPanel />);
    await waitFor(() =>
      expect(screen.getByText("tools.optionalSection")).toBeInTheDocument()
    );
  });

  it("renders all 12 tool toggles", async () => {
    render(<ToolsPanel />);
    await waitFor(() => {
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(12);
    });
  });

  it("calls save_tools when a toggle changes", async () => {
    render(<ToolsPanel />);
    await waitFor(() => screen.getAllByRole("checkbox"));
    const checkboxes = screen.getAllByRole("checkbox");
    await userEvent.click(checkboxes[0]);
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("save_tools", { toolsets: expect.any(Array) })
    );
  });
});
