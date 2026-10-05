import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import GrammarQuizPage from "../quiz/page";

jest.mock("next/link", () => ({ __esModule: true, default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

const original = global.fetch;
beforeEach(() => localStorage.clear());
afterEach(() => {
  global.fetch = original;
  jest.restoreAllMocks();
});

const start = () => fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));

test("a failed first question shows an inline error and lets the learner retry", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({ error: "boom" }) });
  render(<GrammarQuizPage />);
  start();
  expect(await screen.findByRole("alert")).toHaveTextContent("Không thể tạo câu hỏi");
  expect(screen.getByRole("button", { name: "Bắt đầu" })).toBeEnabled();
  expect(screen.queryByText(/Đang tải câu hỏi/)).not.toBeInTheDocument();
});

test("weak mode without enough history explains the rule inline instead of calling alert()", () => {
  const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
  render(<GrammarQuizPage />);
  fireEvent.click(screen.getByRole("button", { name: "Điểm yếu" }));
  start();
  expect(screen.getByRole("alert")).toHaveTextContent("ít nhất 3 lượt");
  expect(alertSpy).not.toHaveBeenCalled();
});

test("a failed prefetch is retried when the learner reaches that question", async () => {
  const q = (n: number) => ({ ok: true, status: 200, json: async () => ({ type: "mcq", question: `Question ${n}?`, options: ["a", "b"], answer: "a" }) });
  const fetcher = jest.fn()
    .mockResolvedValueOnce(q(1)) // first question
    .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({ error: "boom" }) }) // prefetch of the second fails
    .mockResolvedValue(q(2)); // on-demand retry succeeds
  global.fetch = fetcher;
  render(<GrammarQuizPage />);
  start();
  expect(await screen.findByText("Question 1?")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "a" }));
  fireEvent.click(screen.getByRole("button", { name: "Tiếp theo" }));
  await waitFor(() => expect(screen.getByText("Question 2?")).toBeInTheDocument());
});
