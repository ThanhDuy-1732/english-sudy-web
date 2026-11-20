import { fireEvent, render, screen } from "@testing-library/react";
import { useWordJob } from "@/contexts/WordJobContext";
import { WordBankPanel } from "../WordBankPanel";

jest.mock("@/contexts/WordJobContext", () => ({ useWordJob: jest.fn() }));

const mockedUseWordJob = useWordJob as jest.Mock;

function mockJob(overrides: Record<string, unknown> = {}) {
  const startJob = jest.fn();
  mockedUseWordJob.mockReturnValue({
    job: null,
    count: 0,
    wordsPerMinute: 0,
    isOwner: true,
    startJob,
    pauseJob: jest.fn(),
    resumeJob: jest.fn(),
    cancelJob: jest.fn(),
    ...overrides,
  });
  return startJob;
}

beforeEach(() => localStorage.clear());

test("hiện số từ chưa học và mốc mặc định 1.000", () => {
  mockJob();
  render(<WordBankPanel topic="TOEIC" />);
  expect(screen.getByText(/từ chưa học/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "1.000" })).toHaveAttribute("aria-pressed", "true");
});

test("bấm Bắt đầu gọi startJob với chủ đề và mốc đang chọn", () => {
  const startJob = mockJob();
  render(<WordBankPanel topic="TOEIC" />);
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
  expect(startJob).toHaveBeenCalledWith("TOEIC", 1000, ["en"]);
});

test("chọn mốc 300 rồi Bắt đầu dùng đúng mốc", () => {
  const startJob = mockJob();
  render(<WordBankPanel topic="IELTS" />);
  fireEvent.click(screen.getByRole("button", { name: "300" }));
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
  expect(startJob).toHaveBeenCalledWith("IELTS", 300, ["en"]);
});

test("job cùng chủ đề nhưng khác ngôn ngữ không được coi là của bảng này", () => {
  mockJob({ job: { id: "j1", topic: "TOEIC", target: 300, status: "done", langs: ["en", "zh"], createdAt: "", updatedAt: "" } });
  render(<WordBankPanel topic="TOEIC" />);
  expect(screen.queryByText(/Đã đủ/)).not.toBeInTheDocument();
});

test("job đang chạy cùng chủ đề nhưng khác ngôn ngữ thì chặn job mới", () => {
  mockJob({ job: { id: "j1", topic: "TOEIC", target: 300, status: "running", langs: ["en", "zh"], createdAt: "", updatedAt: "" } });
  render(<WordBankPanel topic="TOEIC" />);
  expect(screen.getByRole("button", { name: "Bắt đầu" })).toBeDisabled();
});

test("job đúng chủ đề và ngôn ngữ (thứ tự khác) vẫn là của bảng này", () => {
  mockJob({ job: { id: "j1", topic: "TOEIC", target: 300, status: "done", langs: ["zh", "en"], createdAt: "", updatedAt: "" } });
  render(<WordBankPanel topic="TOEIC" langs={["en", "zh"]} />);
  expect(screen.getByText(/Đã đủ 300 nghĩa/)).toBeInTheDocument();
});
