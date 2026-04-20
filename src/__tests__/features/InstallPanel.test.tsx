import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstallPanel } from "../../features/install/InstallPanel";
import { LangProvider } from "../../i18n";

// jsdom doesn't implement scrollTo on DOM elements
beforeAll(() => {
  window.HTMLElement.prototype.scrollTo = vi.fn();
});

vi.mock("../../lib/tauri", () => ({
  Commands: {
    installHermes: vi.fn().mockResolvedValue(undefined),
    uninstallHermes: vi.fn().mockResolvedValue(undefined),
  },
  Events: {
    onInstallProgress: vi.fn().mockResolvedValue(() => {}),
    onInstallDone: vi.fn().mockResolvedValue(() => {}),
    onInstallError: vi.fn().mockResolvedValue(() => {}),
  },
}));

vi.mock("../../store", () => ({
  useStore: () => ({
    installed: false,
    showToast: vi.fn(),
  }),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <LangProvider>{children}</LangProvider>;
}

describe("InstallPanel", () => {
  it("renders install button", () => {
    render(<Wrapper><InstallPanel /></Wrapper>);
    expect(screen.getByText(/开始安装|Start Install/i)).toBeInTheDocument();
  });

  it("shows progress section when install starts", async () => {
    render(<Wrapper><InstallPanel /></Wrapper>);
    const btn = screen.getByRole("button", { name: /开始安装|Start Install/i });
    await userEvent.click(btn);
    const progressItems = screen.getAllByText(/安装进度|Install Progress/i);
    expect(progressItems.length).toBeGreaterThan(0);
  });
});
