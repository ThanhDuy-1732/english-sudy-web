import { fireEvent, render, screen } from "@testing-library/react";
import DrillPage from "../drill/[part]/page";
import MockPage from "../mock/page";
import { getSessions } from "@/lib/sessions";

jest.mock("react", () => ({ ...jest.requireActual("react"), use: () => ({ part: "RC5" }) }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/components/exam/ExamTimer", () => () => null);
jest.mock("@/components/exam/ExamRunner", () => function ExamRunnerStub({ onComplete }: {
  onComplete: (attempt: { answers: { correct: boolean }[] }) => void;
}) {
  return <button onClick={() => onComplete({ answers: [{ correct: true }, { correct: false }] })}>Complete exam</button>;
});

beforeEach(() => localStorage.clear());

test("drill records results and keeps the finished session", () => {
  const { unmount } = render(<DrillPage params={Promise.resolve({ part: "RC5" })} />);
  expect(getSessions()[0]).toMatchObject({ type: "exam", metadata: { part: "RC5" } });
  fireEvent.click(screen.getByRole("button", { name: "Complete exam" }));
  expect(getSessions()[0]).toMatchObject({ totalItems: 2, correctItems: 1 });
  expect(getSessions()[0].finishedAt).toBeDefined();
  unmount();
  expect(getSessions()).toHaveLength(1);
});

test("mock cancels on early exit and records results after starting", () => {
  const early = render(<MockPage />);
  expect(getSessions()[0]).toMatchObject({ type: "exam", metadata: { mode: "mock" } });
  early.unmount();
  expect(getSessions()).toEqual([]);

  const completed = render(<MockPage />);
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu thi" }));
  fireEvent.click(screen.getByRole("button", { name: "Complete exam" }));
  expect(getSessions()[0]).toMatchObject({ totalItems: 2, correctItems: 1 });
  expect(getSessions()[0].finishedAt).toBeDefined();
  completed.unmount();
  expect(getSessions()).toHaveLength(1);
});
