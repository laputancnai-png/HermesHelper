import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MigratePanel } from "../../components/panels/MigratePanel";
import { invoke } from "@tauri-apps/api/core";

// Mock plugin-dialog
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

import { open, save } from "@tauri-apps/plugin-dialog";

const mockInvoke = invoke as ReturnType<typeof vi.fn>;
const mockOpen = open as ReturnType<typeof vi.fn>;
const mockSave = save as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockOpen.mockResolvedValue(null);
  mockSave.mockResolvedValue(null);
  mockInvoke.mockResolvedValue(undefined);
});

describe("MigratePanel", () => {
  it("renders Export and Import tabs", () => {
    render(<MigratePanel />);
    expect(screen.getByText("migrate.exportTab")).toBeInTheDocument();
    expect(screen.getByText("migrate.importTab")).toBeInTheDocument();
  });

  it("Export tab: all 6 item checkboxes checked by default, API Key unchecked", () => {
    render(<MigratePanel />);
    // 6 item checkboxes + 1 API key checkbox = 7 total
    const checkboxes = Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    ) as HTMLInputElement[];
    expect(checkboxes).toHaveLength(7);
    // First 6 are item checkboxes — all checked
    checkboxes.slice(0, 6).forEach((cb) => expect(cb).toBeChecked());
    // Last one is API Key — unchecked
    expect(checkboxes[6]).not.toBeChecked();
  });

  it("Export tab: clicking export button calls export_data with all items", async () => {
    mockSave.mockResolvedValue("/tmp/backup.zip");
    render(<MigratePanel />);
    await userEvent.click(screen.getByText("migrate.export"));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        "export_data",
        expect.objectContaining({
          items: ["config", "memory", "skills", "history", "cron", "hooks"],
          includeApiKeys: false,
          savePath: "/tmp/backup.zip",
        })
      )
    );
  });

  it("Import tab: shows select file button on step 1", async () => {
    render(<MigratePanel />);
    await userEvent.click(screen.getByText("migrate.importTab"));
    expect(screen.getByText("migrate.selectFile")).toBeInTheDocument();
  });

  it("Import tab: after selecting file, shows conflict list with conflict label", async () => {
    mockOpen.mockResolvedValue("/tmp/backup.zip");
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "preview_import")
        return Promise.resolve([
          { path: "config.toml", category: "config", hasConflict: true },
          { path: ".env", category: "config", hasConflict: false },
        ]);
      return Promise.resolve();
    });
    render(<MigratePanel />);
    await userEvent.click(screen.getByText("migrate.importTab"));
    await userEvent.click(screen.getByText("migrate.selectFile"));
    await waitFor(() =>
      expect(screen.getByText("config.toml")).toBeInTheDocument()
    );
    expect(screen.getByText(".env")).toBeInTheDocument();
    // conflict badge on conflicting file
    expect(screen.getByText("migrate.hasConflict")).toBeInTheDocument();
  });

  it("Import tab: all files are checked by default after preview", async () => {
    mockOpen.mockResolvedValue("/tmp/backup.zip");
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "preview_import")
        return Promise.resolve([
          { path: "config.toml", category: "config", hasConflict: true },
          { path: ".env", category: "config", hasConflict: false },
        ]);
      return Promise.resolve();
    });
    render(<MigratePanel />);
    await userEvent.click(screen.getByText("migrate.importTab"));
    await userEvent.click(screen.getByText("migrate.selectFile"));
    await waitFor(() =>
      expect(screen.getByText("config.toml")).toBeInTheDocument()
    );
    const checkboxes = Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    ) as HTMLInputElement[];
    checkboxes.forEach((cb) => expect(cb).toBeChecked());
  });

  it("Import tab: confirm import calls execute_import with selected files only", async () => {
    mockOpen.mockResolvedValue("/tmp/backup.zip");
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "preview_import")
        return Promise.resolve([
          { path: "config.toml", category: "config", hasConflict: false },
        ]);
      if (cmd === "execute_import")
        return Promise.resolve({ imported: 1, skipped: 0 });
      return Promise.resolve();
    });
    render(<MigratePanel />);
    await userEvent.click(screen.getByText("migrate.importTab"));
    await userEvent.click(screen.getByText("migrate.selectFile"));
    await waitFor(() =>
      expect(screen.getByText("migrate.confirmImport")).toBeInTheDocument()
    );
    await userEvent.click(screen.getByText("migrate.confirmImport"));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        "execute_import",
        expect.objectContaining({
          zipPath: "/tmp/backup.zip",
          selectedFiles: ["config.toml"],
        })
      )
    );
  });
});
