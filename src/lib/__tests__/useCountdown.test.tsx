import { act, renderHook } from "@testing-library/react";
import { useCountdown } from "../useCountdown";

afterEach(() => jest.useRealTimers());

test("counts down and fires onTimeUp once", () => {
  jest.useFakeTimers();
  const onTimeUp = jest.fn();
  const { result } = renderHook(() => useCountdown(3, true, onTimeUp));
  act(() => { jest.advanceTimersByTime(3000); });
  expect(result.current).toBe(0);
  act(() => { jest.advanceTimersByTime(3000); });
  expect(onTimeUp).toHaveBeenCalledTimes(1);
});

test("resets to the full duration while disabled so the next run does not start at 0", () => {
  jest.useFakeTimers();
  const { result, rerender } = renderHook(({ enabled }) => useCountdown(5, enabled), {
    initialProps: { enabled: true },
  });
  act(() => { jest.advanceTimersByTime(5000); });
  expect(result.current).toBe(0);
  rerender({ enabled: false });
  expect(result.current).toBe(5);
});
