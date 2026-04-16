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
  it("renders about heading", async () => {
    render(<InstallPanel />);
    expect(screen.getByText("install.about")).toBeInTheDocument();
  });

  it("renders start install button", () => {
    render(<InstallPanel />);
    expect(screen.getByText("install.start")).toBeInTheDocument();
  });

  it("enables start button by default", () => {
    render(<InstallPanel />);
    const btn = screen.getByText("install.start");
    expect(btn).not.toBeDisabled();
  });

  it("calls install_hermes with no args on start", async () => {
    mockInvoke.mockResolvedValueOnce({ os: "macos", arch: "arm64", osVersion: "" });
    render(<InstallPanel />);
    fireEvent.click(screen.getByText("install.start"));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("install_hermes");
    });
  });
});
