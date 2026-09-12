import { act, render, screen } from "@testing-library/react";
import { TimerContextProvider, useTimer } from "../TimerContext";

beforeEach(() => {
  localStorage.clear();
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-07-21T12:00:00.000Z"));
});

afterEach(() => jest.useRealTimers());

function Consumer() {
  const timer = useTimer();
  return (
    <div>
      <span data-testid="today">{timer.todaySeconds}</span>
      <span data-testid="running">{String(timer.isRunning)}</span>
      <span data-testid="countdown-mode">{String(timer.isCountdownMode)}</span>
      <span data-testid="remaining">{timer.countdownRemaining ?? "null"}</span>
      <span data-testid="time-up">{String(timer.showTimeUp)}</span>
      <button onClick={timer.pause}>pause</button>
      <button onClick={timer.resume}>resume</button>
      <button onClick={() => timer.startCountdown(5)}>start5</button>
      <button onClick={timer.stopCountdown}>stop</button>
      <button onClick={timer.clearTimeUp}>clearTimeUp</button>
    </div>
  );
}

function wrap(ui: React.ReactNode) {
  return render(<TimerContextProvider>{ui}</TimerContextProvider>);
}

test("starts running and increments todaySeconds every second", () => {
  wrap(<Consumer />);
  act(() => { jest.advanceTimersByTime(3000); });
  expect(screen.getByTestId("today").textContent).toBe("3");
  expect(screen.getByTestId("running").textContent).toBe("true");
});

test("pause stops counting", () => {
  wrap(<Consumer />);
  act(() => { screen.getByText("pause").click(); });
  act(() => { jest.advanceTimersByTime(3000); });
  expect(screen.getByTestId("today").textContent).toBe("0");
});

test("resume continues counting after pause", () => {
  wrap(<Consumer />);
  act(() => { jest.advanceTimersByTime(2000); });
  act(() => { screen.getByText("pause").click(); });
  act(() => { jest.advanceTimersByTime(5000); });
  act(() => { screen.getByText("resume").click(); });
  act(() => { jest.advanceTimersByTime(1000); });
  expect(screen.getByTestId("today").textContent).toBe("3");
});

test("startCountdown sets isCountdownMode and countdownRemaining", () => {
  wrap(<Consumer />);
  act(() => { screen.getByText("start5").click(); });
  expect(screen.getByTestId("countdown-mode").textContent).toBe("true");
  expect(screen.getByTestId("remaining").textContent).toBe("5");
});

test("countdown decrements each second", () => {
  wrap(<Consumer />);
  act(() => { screen.getByText("start5").click(); });
  act(() => { jest.advanceTimersByTime(3000); });
  expect(screen.getByTestId("remaining").textContent).toBe("2");
});

test("countdown reaching zero sets showTimeUp=true and clears countdownRemaining", () => {
  wrap(<Consumer />);
  act(() => { screen.getByText("start5").click(); });
  act(() => { jest.advanceTimersByTime(5000); });
  expect(screen.getByTestId("time-up").textContent).toBe("true");
  expect(screen.getByTestId("countdown-mode").textContent).toBe("false");
  expect(screen.getByTestId("remaining").textContent).toBe("null");
});

test("clearTimeUp dismisses showTimeUp", () => {
  wrap(<Consumer />);
  act(() => { screen.getByText("start5").click(); });
  act(() => { jest.advanceTimersByTime(5000); });
  act(() => { screen.getByText("clearTimeUp").click(); });
  expect(screen.getByTestId("time-up").textContent).toBe("false");
});

test("stopCountdown clears countdown without showing time-up", () => {
  wrap(<Consumer />);
  act(() => { screen.getByText("start5").click(); });
  act(() => { jest.advanceTimersByTime(2000); });
  act(() => { screen.getByText("stop").click(); });
  expect(screen.getByTestId("countdown-mode").textContent).toBe("false");
  expect(screen.getByTestId("time-up").textContent).toBe("false");
});

test("reads initial todaySeconds from localStorage", () => {
  localStorage.setItem("studyTime", JSON.stringify({ "2026-07-21": 120 }));
  wrap(<Consumer />);
  expect(screen.getByTestId("today").textContent).toBe("120");
});

test("persists todaySeconds to localStorage after 5 seconds", () => {
  wrap(<Consumer />);
  act(() => { jest.advanceTimersByTime(6000); });
  const data = JSON.parse(localStorage.getItem("studyTime") ?? "{}") as Record<string, number>;
  expect(data["2026-07-21"]).toBeGreaterThanOrEqual(5);
});
