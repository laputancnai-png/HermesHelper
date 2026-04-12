import { render, screen, fireEvent } from "@testing-library/react";
import { HomePanel } from "../../components/panels/HomePanel";
import { invoke } from "@tauri-apps/api/core";

const mockInvoke = invoke as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockInvoke.mockResolvedValue([]);
});

describe("HomePanel", () => {
  it("renders status cards", () => {
    render(<HomePanel />);
    expect(screen.getByText("安装状态")).toBeInTheDocument();
    expect(screen.getByText("当前版本")).toBeInTheDocument();
  });

  it("shows 'run doctor' button", () => {
    render(<HomePanel />);
    expect(screen.getByText("运行诊断")).toBeInTheDocument();
  });

  it("calls run_doctor on button click", async () => {
    mockInvoke.mockResolvedValueOnce([
      { status: "ok", message: "hermes command available" },
    ]);
    render(<HomePanel />);
    fireEvent.click(screen.getByText("运行诊断"));
    expect(mockInvoke).toHaveBeenCalledWith("run_doctor");
  });
});
