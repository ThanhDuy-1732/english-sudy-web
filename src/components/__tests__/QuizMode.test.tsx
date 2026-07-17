import { act, fireEvent, render, screen } from "@testing-library/react";
import QuizMode from "../QuizMode";

beforeEach(() => {
  localStorage.clear();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test("locks the answer after the first click until the next question", () => {
  render(
    <QuizMode
      words={[
        { word: "greet", meaning: "chào hỏi" },
        { word: "smile", meaning: "mỉm cười" },
      ]}
      onClose={jest.fn()}
    />,
  );

  const answer = screen.getByRole("button", { name: "greet" });
  fireEvent.click(answer);
  fireEvent.click(answer);

  expect(screen.getByText("Đúng rồi! ✓")).toBeInTheDocument();
  expect(screen.getByText("1 / 2")).toBeInTheDocument();
  expect(answer).toBeDisabled();

  act(() => {
    jest.advanceTimersByTime(800);
  });

  expect(screen.getByText("2 / 2")).toBeInTheDocument();
});
