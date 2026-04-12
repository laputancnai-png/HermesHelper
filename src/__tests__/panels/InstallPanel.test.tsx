import { render, screen, fireEvent } from "@testing-library/react";
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
  it("renders wizard step 1", async () => {
    render(<InstallPanel />);
    expect(screen.getByText(/选择安装模式/)).toBeInTheDocument();
  });

  it("shows install mode options", () => {
    render(<InstallPanel />);
    expect(screen.getByText("完整安装")).toBeInTheDocument();
    expect(screen.getByText("仅核心")).toBeInTheDocument();
    expect(screen.getByText("含 Voice")).toBeInTheDocument();
  });

  it("enables start button when mode selected", () => {
    render(<InstallPanel />);
    const btn = screen.getByText("开始安装");
    expect(btn).not.toBeDisabled();
  });

  it("calls install_hermes on start", async () => {
    mockInvoke.mockResolvedValueOnce({ os: "macos", arch: "arm64", osVersion: "" });
    render(<InstallPanel />);
    fireEvent.click(screen.getByText("开始安装"));
    expect(mockInvoke).toHaveBeenCalledWith("install_hermes", { mode: "full" });
  });
});
