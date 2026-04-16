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

  it("applies accent track color when checked (iOS style)", () => {
    const { container } = render(
      <Toggle label="iOS Toggle" checked={true} onChange={() => {}} />
    );
    // The track div should have bg-accent class when checked
    expect(container.querySelector(".bg-accent")).toBeInTheDocument();
  });

  it("applies secondary track color when unchecked", () => {
    const { container } = render(
      <Toggle label="iOS Toggle" checked={false} onChange={() => {}} />
    );
    expect(container.querySelector(".bg-bg-secondary")).toBeInTheDocument();
  });
});
