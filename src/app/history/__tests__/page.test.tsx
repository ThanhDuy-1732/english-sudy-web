import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import HistoryPage from "../page";

const longWord = "professionalcommunicationwithoutspaces";

beforeEach(() => {
  localStorage.clear();
});

test("uses an accessible empty state and selected filter", async () => {
  render(<HistoryPage />);

  await waitFor(() => expect(screen.getByText("Chưa có từ nào được lưu.")).toBeInTheDocument());
  expect(screen.getByRole("radio", { name: "Tất cả" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("renders long saved content with an accessible delete action", async () => {
  localStorage.setItem(
    "learnedWords",
    JSON.stringify([
      {
        word: longWord,
        meaning: "giao tiếp chuyên nghiệp trong một môi trường làm việc phân tán",
        example:
          "Clear professional communication helps every member understand the goal and complete the work confidently.",
        topic: "Daily Communication",
        learnedAt: "2026-07-16T00:00:00.000Z",
      },
    ]),
  );

  render(<HistoryPage />);

  await waitFor(() => expect(screen.getByText(longWord)).toBeInTheDocument());
  expect(screen.getByRole("button", { name: `Xóa ${longWord}` })).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "Giao tiếp hằng ngày" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
});

test("shows growth stage and filters weak words", async () => {
  localStorage.setItem("learnedWords", JSON.stringify([
    { word: "weak", meaning: "yếu", example: "A sentence.", topic: "TOEIC", learnedAt: "2026-07-16T00:00:00.000Z", mastery: 1 },
    { word: "strong", meaning: "mạnh", example: "Another sentence.", topic: "TOEIC", learnedAt: "2026-07-16T00:00:00.000Z", mastery: 4 },
  ]));
  render(<HistoryPage />);
  await waitFor(() => expect(screen.getByText("weak")).toBeInTheDocument());
  expect(screen.getByLabelText("Giai đoạn Mầm (1/5)")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Chỉ từ chưa thuộc" }));
  expect(screen.getByText("weak")).toBeInTheDocument();
  expect(screen.queryByText("strong")).not.toBeInTheDocument();
});

describe("languages", () => {
  const w = (word: string, lang?: string) => ({ word, meaning: "học sinh", example: "", topic: "TOEIC", learnedAt: "2026-07-16T00:00:00.000Z", ...(lang ? { lang } : {}) });

  test("language filter shows only Chinese words", async () => {
    localStorage.setItem("learnedWords", JSON.stringify([w("student"), w("学生", "zh"), w("学生", "ja")]));
    render(<HistoryPage />);
    await waitFor(() => expect(screen.getByText("student")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("radio", { name: "中文" }));
    expect(screen.queryByText("student")).not.toBeInTheDocument();
    const shown = screen.getAllByText("学生");
    expect(shown).toHaveLength(1);
    expect(shown[0]).toHaveAttribute("lang", "zh-CN");
  });

  test("deleting a zh word keeps the ja word with the same characters", async () => {
    localStorage.setItem("learnedWords", JSON.stringify([w("学生", "zh"), w("学生", "ja")]));
    render(<HistoryPage />);
    await waitFor(() => expect(screen.getAllByText("学生")).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: "Xóa 学生 (Tiếng Trung)" }));
    const left = JSON.parse(localStorage.getItem("learnedWords")!);
    expect(left).toHaveLength(1);
    expect(left[0].lang).toBe("ja");
  });

  test("english-only saved words show no language filter", async () => {
    localStorage.setItem("learnedWords", JSON.stringify([w("student")]));
    render(<HistoryPage />);
    await waitFor(() => expect(screen.getByText("student")).toBeInTheDocument());
    expect(screen.queryByRole("radiogroup", { name: "Ngôn ngữ" })).toBeNull();
  });
});
