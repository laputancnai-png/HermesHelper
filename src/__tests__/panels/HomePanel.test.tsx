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
    expect(screen.getByText("home.installStatus")).toBeInTheDocument();
    expect(screen.getByText("home.currentVersion")).toBeInTheDocument();
    expect(screen.getByText("home.doctorResults")).toBeInTheDocument();
  });

  it("shows 'run doctor' button", () => {
    render(<HomePanel />);
    expect(screen.getByText("home.runDiagnosis")).toBeInTheDocument();
  });

  it("calls run_doctor on button click", async () => {
    mockInvoke.mockResolvedValueOnce([
      { status: "ok", message: "hermes command available" },
    ]);
    render(<HomePanel />);
    fireEvent.click(screen.getByText("home.runDiagnosis"));
    expect(mockInvoke).toHaveBeenCalledWith("run_doctor");
  });
});
