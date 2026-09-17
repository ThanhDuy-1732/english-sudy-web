import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import WritingTaskPage from "../task/[id]/page";
import { getSessions } from "@/lib/sessions";

const mockPush = jest.fn();
jest.mock("react", () => ({ ...jest.requireActual("react"), use: () => ({ id: "toeic-email" }) }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  mockPush.mockClear();
});

test("starts once, cancels on early exit, and finishes after saving feedback", async () => {
  const early = render(<WritingTaskPage params={Promise.resolve({ id: "toeic-email" })} />);
  expect(getSessions()[0]).toMatchObject({ type: "writing", metadata: { taskId: "toeic-email" } });
  early.rerender(<WritingTaskPage params={Promise.resolve({ id: "toeic-email" })} />);
  expect(getSessions()).toHaveLength(1);
  early.unmount();
  expect(getSessions()).toEqual([]);

  global.fetch = jest.fn().mockResolvedValue({ json: async () => ({ overall: 7 }) });
  const completed = render(<WritingTaskPage params={Promise.resolve({ id: "toeic-email" })} />);
  fireEvent.click(screen.getByRole("button", { name: /Bắt đầu viết/ }));
  fireEvent.change(screen.getByPlaceholderText("Bắt đầu viết bài của bạn ở đây…"), {
    target: { value: Array(100).fill("word").join(" ") },
  });
  fireEvent.click(screen.getByRole("button", { name: "📤 Nộp bài" }));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/write/result/toeic-email"));
  expect(sessionStorage.getItem("writing-result-toeic-email")).toContain('"overall":7');
  expect(getSessions()[0].finishedAt).toBeDefined();
  expect(getSessions()[0].totalItems).toBeUndefined();
  completed.unmount();
  expect(getSessions()).toHaveLength(1);
});
