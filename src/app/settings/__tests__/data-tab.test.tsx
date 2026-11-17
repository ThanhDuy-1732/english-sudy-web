import { render, screen, fireEvent, act } from "@testing-library/react";
import SettingsPage from "../page";
import { clearAllData, exportData } from "@/lib/data-transfer";

jest.mock("@/lib/data-transfer", () => ({
  ...jest.requireActual("@/lib/data-transfer"),
  clearAllData: jest.fn(() => 3),
  exportData: jest.fn(() => '{"app":"english-study"}'),
  importData: jest.fn(),
}));

jest.mock("@/lib/speech/audio-store", () => ({
  getAudioCount: jest.fn().mockResolvedValue(0),
  clearAllAudio: jest.fn().mockResolvedValue(0),
}));

const exportDataMock = exportData as jest.Mock;
const clearAllDataMock = clearAllData as jest.Mock;

beforeEach(() => {
  exportDataMock.mockClear();
  clearAllDataMock.mockClear();
  global.fetch = jest.fn().mockResolvedValue({ json: async () => [] }) as jest.Mock;
  URL.createObjectURL = jest.fn(() => "blob:backup");
  URL.revokeObjectURL = jest.fn();
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

async function renderDataTab() {
  await act(async () => {
    render(<SettingsPage />);
  });
  fireEvent.click(screen.getByRole("radio", { name: "Dữ liệu" }));
}

test("data tab exposes export, import and clear actions", async () => {
  await renderDataTab();

  expect(screen.getByText("Xuất dữ liệu")).toBeInTheDocument();
  expect(screen.getByText("Nhập dữ liệu")).toBeInTheDocument();
  expect(screen.getByText("Xoá toàn bộ dữ liệu")).toBeInTheDocument();
  expect(screen.getByText("Gộp từ file")).toBeInTheDocument();
  expect(screen.getByText("Thay thế bằng file")).toBeInTheDocument();
  expect(screen.getByText("Dung lượng")).toBeInTheDocument();
});

test("export button downloads the JSON produced by exportData", async () => {
  await renderDataTab();
  fireEvent.click(screen.getByText("Xuất file sao lưu"));

  expect(exportDataMock).toHaveBeenCalledTimes(1);
  expect(URL.createObjectURL).toHaveBeenCalled();
  expect(screen.getByText("Đã xuất file sao lưu.")).toBeInTheDocument();
  expect(localStorage.getItem("lastBackupAt")).not.toBeNull();
});

test("clear requires a second click before wiping data", async () => {
  await renderDataTab();

  fireEvent.click(screen.getByText("Xoá dữ liệu"));
  expect(clearAllDataMock).not.toHaveBeenCalled();
  expect(screen.getByText("Bấm lần nữa để xoá toàn bộ")).toBeInTheDocument();
});
