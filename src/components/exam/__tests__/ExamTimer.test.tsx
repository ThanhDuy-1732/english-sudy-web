import { act, render, screen } from "@testing-library/react";
import ExamTimer from "../ExamTimer";

test("expires once after returning from a suspended app", () => {
  jest.useFakeTimers();
  jest.setSystemTime(0);
  const onTimeUp = jest.fn();
  const view = render(<ExamTimer totalSeconds={60} onTimeUp={onTimeUp} />);
  jest.setSystemTime(65_000);
  act(() => { document.dispatchEvent(new Event("visibilitychange")); });
  expect(screen.getByText(/00:00/)).toBeInTheDocument();
  expect(onTimeUp).toHaveBeenCalledTimes(1);
  act(() => { jest.advanceTimersByTime(2000); });
  expect(onTimeUp).toHaveBeenCalledTimes(1);
  view.unmount();
  jest.useRealTimers();
});

test("does not count down until enabled", () => {
  jest.useFakeTimers();
  jest.setSystemTime(0);
  const onTimeUp = jest.fn();
  const view = render(<ExamTimer totalSeconds={60} onTimeUp={onTimeUp} enabled={false} />);
  act(() => { jest.advanceTimersByTime(120_000); });
  expect(screen.getByText(/01:00/)).toBeInTheDocument();
  expect(onTimeUp).not.toHaveBeenCalled();
  view.rerender(<ExamTimer totalSeconds={60} onTimeUp={onTimeUp} enabled />);
  act(() => { jest.advanceTimersByTime(10_000); });
  expect(screen.getByText(/00:50/)).toBeInTheDocument();
  view.unmount();
  jest.useRealTimers();
});
