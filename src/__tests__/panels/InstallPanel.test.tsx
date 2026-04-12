import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InstallPanel } from "../../components/panels/InstallPanel";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const mockInvoke = invoke as ReturnType<typeof vi.fn>;
const mockListen = listen as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockInvoke.mockResolvedValue({ os: "macos", arch: "arm64", osVersion: "14.4" });
  mockListen.mockResolvedValue(() => {});
});

describe("InstallPanel", () => {
  it("renders mode selection heading", async () => {
    render(<InstallPanel />);
    expect(screen.getByText("install.selectMode")).toBeInTheDocument();
  });

  it("shows install mode options", () => {
    render(<InstallPanel />);
    expect(screen.getByText("install.mode.full.label")).toBeInTheDocument();
    expect(screen.getByText("install.mode.core.label")).toBeInTheDocument();
    expect(screen.getByText("install.mode.voice.label")).toBeInTheDocument();
  });

  it("enables start button when mode selected", () => {
    render(<InstallPanel />);
    const btn = screen.getByText("install.start");
    expect(btn).not.toBeDisabled();
  });

  it("calls install_hermes on start", async () => {
    mockInvoke.mockResolvedValueOnce({ os: "macos", arch: "arm64", osVersion: "" });
    render(<InstallPanel />);
    fireEvent.click(screen.getByText("install.start"));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("install_hermes", { mode: "full" });
    });
  });
});
