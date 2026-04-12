import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toggle } from "../../components/ui/Toggle";

describe("Toggle", () => {
  it("renders label", () => {
    render(<Toggle label="Persistent Memory" checked={false} onChange={() => {}} />);
    expect(screen.getByText("Persistent Memory")).toBeInTheDocument();
  });

  it("calls onChange when clicked", async () => {
    const onChange = vi.fn();
    render(<Toggle label="Test" checked={false} onChange={onChange} />);
    await userEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("shows checked state", () => {
    render(<Toggle label="Test" checked={true} onChange={() => {}} />);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });
});
