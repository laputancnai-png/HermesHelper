import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GatewayPanel } from "../../components/panels/GatewayPanel";
import { invoke } from "@tauri-apps/api/core";

const mockInvoke = invoke as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === "get_gateway_config")
      return Promise.resolve({ botToken: "", allowedUsers: "" });
    if (cmd === "get_gateway_status")
      return Promise.resolve({ running: false });
    if (cmd === "save_gateway_config") return Promise.resolve();
    if (cmd === "start_gateway") return Promise.resolve();
    if (cmd === "stop_gateway") return Promise.resolve();
    return Promise.resolve();
  });
});

describe("GatewayPanel", () => {
  it("renders Telegram config section header", async () => {
    render(<GatewayPanel />);
    await waitFor(() =>
      expect(screen.getByText("gateway.section")).toBeInTheDocument()
    );
  });

  it("token input defaults to password type", async () => {
    render(<GatewayPanel />);
    await waitFor(() => screen.getByText("gateway.show"));
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    expect(passwordInputs).toHaveLength(1);
  });

  it("clicking show button switches token to text type", async () => {
    render(<GatewayPanel />);
    await waitFor(() => screen.getByText("gateway.show"));
    await userEvent.click(screen.getByText("gateway.show"));
    const textInputs = document.querySelectorAll('input[type="text"]');
    // At least the token input is now text type
    expect(textInputs.length).toBeGreaterThanOrEqual(1);
  });

  it("save button calls save_gateway_config", async () => {
    render(<GatewayPanel />);
    await waitFor(() => screen.getByText("gateway.saveConfig"));
    await userEvent.click(screen.getByText("gateway.saveConfig"));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        "save_gateway_config",
        expect.objectContaining({ botToken: "", allowedUsers: "" })
      )
    );
  });

  it("start button is disabled when token is empty", async () => {
    render(<GatewayPanel />);
    await waitFor(() => screen.getByText("gateway.start"));
    const startBtn = screen.getByText("gateway.start").closest("button");
    expect(startBtn).toBeDisabled();
  });

  it("start button triggers start_gateway when token is set", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_gateway_config")
        return Promise.resolve({ botToken: "test-token", allowedUsers: "" });
      if (cmd === "get_gateway_status")
        return Promise.resolve({ running: false });
      if (cmd === "start_gateway") return Promise.resolve();
      return Promise.resolve();
    });
    render(<GatewayPanel />);
    await waitFor(() => {
      const startBtn = screen.getByText("gateway.start").closest("button");
      expect(startBtn).not.toBeDisabled();
    });
    await userEvent.click(screen.getByText("gateway.start").closest("button")!);
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("start_gateway")
    );
  });
});
