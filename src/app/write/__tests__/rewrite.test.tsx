import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RewritePage from "../rewrite/[id]/page";

jest.mock("next/navigation", () => ({ useParams: () => ({ id: "r1" }), useRouter: () => ({ push: jest.fn() }) }));
jest.mock("next/link", () => ({ __esModule: true, default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

const record = {
  id: "r1",
  kind: "ielts_task2",
  prompt: "P",
  content: "Essay",
  wordCount: 100,
  createdAt: "2026-09-01T00:00:00.000Z",
  feedback: {
    bands: { task: 6, coherence: 6, lexical: 6, grammar: 6 },
    overall: 6,
    wordCount: 100,
    modelAnswer: "m",
    nextFocus: "n",
    annotations: [{ excerpt: "bad sentence", issue: "grammar slip", category: "grammar", suggestion: "good sentence" }],
  },
};

const respond = (ok: boolean, body: unknown) => jest.fn().mockResolvedValue({ ok, status: ok ? 200 : 502, json: async () => body });

const originalFetch = global.fetch;

async function check(fetcher: jest.Mock) {
  global.fetch = fetcher;
  localStorage.setItem("writingSubmissions", JSON.stringify([record]));
  render(<RewritePage />);
  fireEvent.change(await screen.findByRole("textbox"), { target: { value: "my attempt" } });
  fireEvent.click(screen.getByRole("button", { name: "Kiểm tra" }));
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  global.fetch = originalFetch;
});

test("a failed grading request shows an error, no verdict, and logs no mistake", async () => {
  await check(respond(false, { error: "Unable to grade" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Không thể chấm");
  expect(screen.queryByText("Chưa chính xác")).not.toBeInTheDocument();
  expect(screen.queryByText(/Gợi ý/)).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem("unifiedMistakes") ?? "[]")).toHaveLength(0);
});

test("a graded wrong answer is still logged as a mistake", async () => {
  await check(respond(true, { correct: false, feedback: "Try again" }));
  expect(await screen.findByText("Chưa chính xác")).toBeInTheDocument();
  await waitFor(() => expect(JSON.parse(localStorage.getItem("unifiedMistakes") ?? "[]")).toHaveLength(1));
});
