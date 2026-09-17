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

test("mock: no session before start; cancels on early exit after starting; records results on complete", () => {
  // No session created until user clicks "Bắt đầu thi"
  const early = render(<MockPage />);
  expect(getSessions()).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu thi" }));
  expect(getSessions()[0]).toMatchObject({ type: "exam", metadata: { mode: "mock" } });
  early.unmount();
  expect(getSessions()).toHaveLength(0); // cancelled on unmount before completing

  const completed = render(<MockPage />);
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu thi" }));
  fireEvent.click(screen.getByRole("button", { name: "Complete exam" }));
  expect(getSessions()[0]).toMatchObject({ totalItems: 2, correctItems: 1 });
  expect(getSessions()[0].finishedAt).toBeDefined();
  completed.unmount();
  expect(getSessions()).toHaveLength(1);
});
