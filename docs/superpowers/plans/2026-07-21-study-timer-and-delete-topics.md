# Study Timer + Delete Custom Topics — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a unified study timer to the header navbar (auto daily tracking + user-set countdown with modal), show time data on the Stats page, and add the ability to delete custom topic pills.

**Architecture:** A new `TimerContext` wraps the entire app and owns a single `setInterval`. `HeaderTimer` is a client component rendered in the navbar that reads context state, toggles pause/resume, and opens modals. Stats page gets a new `getStudyTimePerDay()` function and `StudyTimeChart` component. Delete-topics is a standalone CRUD addition to `custom-topics.ts` and `TopicSelector.tsx`.

**Tech Stack:** Next.js 14 App Router, React context, localStorage, Recharts (already used), Tailwind CSS, Jest + Testing Library

## Global Constraints

- `localStorage` is the only persistence layer — no server or Supabase calls for timer data
- New localStorage key: `"studyTime"` — `Record<string, number>` (ISO date string `"YYYY-MM-DD"` → total seconds studied that day)
- All client components must have `"use client"` as first line
- Tailwind color palette already in use: `#2c1f4a` (bg), `#7f56d9` (accent), `#d9ecff` (light text), `#b0b0d1` (muted text), `#6941c6` (accent hover)
- Run `npm test` after every task — all tests must pass before committing
- Run `npm run lint` before each commit

---

### Task 1: Delete Custom Topics

**Files:**
- Modify: `src/lib/custom-topics.ts`
- Modify: `src/components/TopicSelector.tsx`
- Modify: `src/lib/__tests__/custom-topics.test.ts`
- Modify: `src/components/__tests__/TopicSelector.test.tsx`

**Interfaces:**
- Produces: `deleteCustomTopic(topic: string): void` — removes topic from `localStorage["customTopics"]`

- [ ] **Step 1: Write failing tests for deleteCustomTopic**

Add to `src/lib/__tests__/custom-topics.test.ts`:

```ts
import { deleteCustomTopic, getCustomTopics, saveCustomTopic } from "../custom-topics";

// existing tests remain...

test("deleteCustomTopic removes the topic", () => {
  saveCustomTopic("Cooking");
  saveCustomTopic("Travel");
  deleteCustomTopic("Cooking");
  expect(getCustomTopics()).toEqual(["Travel"]);
});

test("deleteCustomTopic is a no-op when topic does not exist", () => {
  saveCustomTopic("Cooking");
  deleteCustomTopic("Unknown");
  expect(getCustomTopics()).toEqual(["Cooking"]);
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
npm test -- --testPathPattern=custom-topics
```

Expected: FAIL — `deleteCustomTopic is not a function`

- [ ] **Step 3: Implement deleteCustomTopic**

Add to `src/lib/custom-topics.ts` (after `saveCustomTopic`):

```ts
export function deleteCustomTopic(topic: string) {
  if (typeof window === "undefined") return;
  const existing = getCustomTopics().filter((t) => t !== topic);
  localStorage.setItem(KEY, JSON.stringify(existing));
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npm test -- --testPathPattern=custom-topics
```

Expected: PASS (all 5 tests)

- [ ] **Step 5: Write failing UI tests for delete button**

Replace the full content of `src/components/__tests__/TopicSelector.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import TopicSelector from "../TopicSelector";

beforeEach(() => localStorage.clear());

test("renders both built-in topic buttons", () => {
  render(<TopicSelector value="Daily Communication" onChange={jest.fn()} />);
  expect(screen.getByText("Daily Communication")).toBeInTheDocument();
  expect(screen.getByText("TOEIC")).toBeInTheDocument();
});

test("calls onChange with selected topic", () => {
  const onChange = jest.fn();
  render(<TopicSelector value="Daily Communication" onChange={onChange} />);
  fireEvent.click(screen.getByText("TOEIC"));
  expect(onChange).toHaveBeenCalledWith("TOEIC");
});

test("active topic button has different style", () => {
  render(<TopicSelector value="TOEIC" onChange={jest.fn()} />);
  const active = screen.getByText("TOEIC");
  expect(active.className).toContain("bg-[#7f56d9]");
  expect(active).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("Daily Communication")).toHaveAttribute("aria-pressed", "false");
});

test("built-in topics do not have a delete button", () => {
  render(<TopicSelector value="Daily Communication" onChange={jest.fn()} />);
  const deleteButtons = screen.queryAllByRole("button", { name: /verwijder|xóa|delete|×/i });
  // No delete buttons for built-in topics
  expect(deleteButtons).toHaveLength(0);
});

test("custom topic shows a delete button", () => {
  localStorage.setItem("customTopics", JSON.stringify(["Cooking"]));
  render(<TopicSelector value="Daily Communication" onChange={jest.fn()} />);
  expect(screen.getByText("Cooking")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Xóa chủ đề Cooking" })).toBeInTheDocument();
});

test("clicking delete removes custom topic from UI", () => {
  localStorage.setItem("customTopics", JSON.stringify(["Cooking"]));
  render(<TopicSelector value="Daily Communication" onChange={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Xóa chủ đề Cooking" }));
  expect(screen.queryByText("Cooking")).not.toBeInTheDocument();
});

test("deleting the currently selected custom topic resets to first built-in topic", () => {
  localStorage.setItem("customTopics", JSON.stringify(["Cooking"]));
  const onChange = jest.fn();
  render(<TopicSelector value="Cooking" onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Xóa chủ đề Cooking" }));
  expect(onChange).toHaveBeenCalledWith("Daily Communication");
});
```

- [ ] **Step 6: Run UI tests to confirm failure**

```bash
npm test -- --testPathPattern=TopicSelector
```

Expected: FAIL — delete button tests fail

- [ ] **Step 7: Update TopicSelector to add delete button on custom topics**

Replace the full content of `src/components/TopicSelector.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { deleteCustomTopic, getCustomTopics, saveCustomTopic } from "@/lib/custom-topics";
import { pushTopic } from "@/lib/sync";

const TOPICS = ["Daily Communication", "TOEIC"];

interface TopicSelectorProps {
  value: string;
  onChange: (topic: string) => void;
}

export default function TopicSelector({ value, onChange }: TopicSelectorProps) {
  const [customTopics, setCustomTopics] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => setCustomTopics(getCustomTopics()), []);

  function addTopic() {
    const topic = inputValue.trim();
    if (!topic) return;
    saveCustomTopic(topic);
    void pushTopic(topic);
    setCustomTopics(getCustomTopics());
    onChange(topic);
    setInputValue("");
  }

  function removeTopic(topic: string) {
    deleteCustomTopic(topic);
    setCustomTopics(getCustomTopics());
    if (value === topic) onChange(TOPICS[0]);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {TOPICS.map((topic) => (
          <button
            type="button"
            key={topic}
            onClick={() => onChange(topic)}
            aria-pressed={value === topic}
            className={`min-h-12 rounded-full px-5 text-sm font-semibold transition-colors ${
              value === topic
                ? "bg-[#7f56d9] text-white shadow-lg shadow-black/20"
                : "bg-white/10 text-[#d9ecff] hover:bg-white/15"
            }`}
          >
            {topic}
          </button>
        ))}
        {customTopics.map((topic) => (
          <div key={topic} className="flex items-center">
            <button
              type="button"
              onClick={() => onChange(topic)}
              aria-pressed={value === topic}
              className={`min-h-12 rounded-l-full pl-5 pr-3 text-sm font-semibold transition-colors ${
                value === topic
                  ? "bg-[#7f56d9] text-white shadow-lg shadow-black/20"
                  : "bg-white/10 text-[#d9ecff] hover:bg-white/15"
              }`}
            >
              {topic}
            </button>
            <button
              type="button"
              onClick={() => removeTopic(topic)}
              aria-label={`Xóa chủ đề ${topic}`}
              className={`min-h-12 rounded-r-full pr-4 pl-1 text-sm transition-colors ${
                value === topic
                  ? "bg-[#7f56d9] text-white/70 hover:text-white shadow-lg shadow-black/20"
                  : "bg-white/10 text-[#b0b0d1] hover:text-white hover:bg-white/15"
              }`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="flex min-w-0 gap-2">
        <input
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") addTopic(); }}
          placeholder="Chủ đề khác... (nhấn Enter)"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm text-white placeholder:text-[#b0b0d1] focus:border-[#d9ecff] focus:outline-none"
        />
        <button
          type="button"
          onClick={addTopic}
          disabled={!inputValue.trim()}
          className="min-h-11 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-[#d9ecff] transition-colors hover:bg-white/15 disabled:opacity-50"
        >
          + Thêm
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Run all tests**

```bash
npm test -- --testPathPattern="custom-topics|TopicSelector"
```

Expected: PASS (all tests)

- [ ] **Step 9: Lint and commit**

```bash
npm run lint
git add src/lib/custom-topics.ts src/components/TopicSelector.tsx src/lib/__tests__/custom-topics.test.ts src/components/__tests__/TopicSelector.test.tsx
git commit -m "feat: add delete button for custom topics"
```

---

### Task 2: TimerContext

**Files:**
- Create: `src/contexts/TimerContext.tsx`
- Create: `src/contexts/__tests__/TimerContext.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export function useTimer(): TimerContextValue
  export function TimerContextProvider({ children }: { children: React.ReactNode }): JSX.Element
  
  interface TimerContextValue {
    todaySeconds: number;
    isRunning: boolean;
    isCountdownMode: boolean;      // true when countdownRemaining !== null
    countdownTarget: number | null;
    countdownRemaining: number | null;
    showTimeUp: boolean;
    pause(): void;
    resume(): void;
    startCountdown(seconds: number): void;
    stopCountdown(): void;
    clearTimeUp(): void;
  }
  ```

- [ ] **Step 1: Write failing tests**

Create `src/contexts/__tests__/TimerContext.test.tsx`:

```tsx
import { act, render, screen } from "@testing-library/react";
import { TimerContextProvider, useTimer } from "../TimerContext";

beforeEach(() => {
  localStorage.clear();
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-07-21T12:00:00.000Z"));
});
afterEach(() => jest.useRealTimers());

function Consumer() {
  const t = useTimer();
  return (
    <div>
      <span data-testid="today">{t.todaySeconds}</span>
      <span data-testid="running">{String(t.isRunning)}</span>
      <span data-testid="countdown-mode">{String(t.isCountdownMode)}</span>
      <span data-testid="remaining">{t.countdownRemaining ?? "null"}</span>
      <span data-testid="time-up">{String(t.showTimeUp)}</span>
      <button onClick={t.pause}>pause</button>
      <button onClick={t.resume}>resume</button>
      <button onClick={() => t.startCountdown(5)}>start5</button>
      <button onClick={t.stopCountdown}>stop</button>
      <button onClick={t.clearTimeUp}>clearTimeUp</button>
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
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npm test -- --testPathPattern=TimerContext
```

Expected: FAIL — `Cannot find module '../TimerContext'`

- [ ] **Step 3: Implement TimerContext**

Create `src/contexts/TimerContext.tsx`:

```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "studyTime";

function getTodayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function readTodaySeconds(): number {
  if (typeof window === "undefined") return 0;
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, number>;
    return data[getTodayKey()] ?? 0;
  } catch { return 0; }
}

function writeTodaySeconds(seconds: number): void {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, number>;
    data[getTodayKey()] = seconds;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

interface TimerContextValue {
  todaySeconds: number;
  isRunning: boolean;
  isCountdownMode: boolean;
  countdownTarget: number | null;
  countdownRemaining: number | null;
  showTimeUp: boolean;
  pause(): void;
  resume(): void;
  startCountdown(seconds: number): void;
  stopCountdown(): void;
  clearTimeUp(): void;
}

const TimerContext = createContext<TimerContextValue>({
  todaySeconds: 0,
  isRunning: false,
  isCountdownMode: false,
  countdownTarget: null,
  countdownRemaining: null,
  showTimeUp: false,
  pause: () => {},
  resume: () => {},
  startCountdown: () => {},
  stopCountdown: () => {},
  clearTimeUp: () => {},
});

export function useTimer(): TimerContextValue {
  return useContext(TimerContext);
}

export function TimerContextProvider({ children }: { children: React.ReactNode }) {
  const [todaySeconds, setTodaySeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [countdownTarget, setCountdownTarget] = useState<number | null>(null);
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  const [showTimeUp, setShowTimeUp] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTodaySeconds(readTodaySeconds());
  }, []);

  const schedulePersist = useCallback((seconds: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => writeTodaySeconds(seconds), 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [schedulePersist]);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      setTodaySeconds((prev) => {
        const next = prev + 1;
        schedulePersist(next);
        return next;
      });
      setCountdownRemaining((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          setShowTimeUp(true);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning, schedulePersist]);

  const pause = useCallback(() => setIsRunning(false), []);
  const resume = useCallback(() => setIsRunning(true), []);

  const startCountdown = useCallback((seconds: number) => {
    setCountdownTarget(seconds);
    setCountdownRemaining(seconds);
    setShowTimeUp(false);
    setIsRunning(true);
  }, []);

  const stopCountdown = useCallback(() => {
    setCountdownTarget(null);
    setCountdownRemaining(null);
  }, []);

  const clearTimeUp = useCallback(() => {
    setShowTimeUp(false);
    setCountdownTarget(null);
  }, []);

  return (
    <TimerContext.Provider value={{
      todaySeconds,
      isRunning,
      isCountdownMode: countdownRemaining !== null,
      countdownTarget,
      countdownRemaining,
      showTimeUp,
      pause,
      resume,
      startCountdown,
      stopCountdown,
      clearTimeUp,
    }}>
      {children}
    </TimerContext.Provider>
  );
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npm test -- --testPathPattern=TimerContext
```

Expected: PASS (all 10 tests)

- [ ] **Step 5: Lint and commit**

```bash
npm run lint
git add src/contexts/TimerContext.tsx src/contexts/__tests__/TimerContext.test.tsx
git commit -m "feat: add TimerContext for study time tracking"
```

---

### Task 3: HeaderTimer Component

**Files:**
- Create: `src/components/HeaderTimer.tsx`

**Interfaces:**
- Consumes: `useTimer()` from `src/contexts/TimerContext.tsx` (all fields)
- Produces: `export default function HeaderTimer(): JSX.Element` — drop-in navbar component

Note: `SetCountdownModal` and `TimeUpModal` are defined in the same file as non-exported helpers. No separate files needed.

- [ ] **Step 1: Create HeaderTimer.tsx**

Create `src/components/HeaderTimer.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTimer } from "@/contexts/TimerContext";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function SetCountdownModal({ onClose }: { onClose: () => void }) {
  const { startCountdown } = useTimer();
  const [minutes, setMinutes] = useState(25);

  function handleStart() {
    if (minutes < 1) return;
    startCountdown(minutes * 60);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true" aria-label="Đặt thời gian học">
      <div className="w-80 rounded-2xl bg-[#2c1f4a] p-6 shadow-xl border border-white/10">
        <h2 className="mb-4 font-display text-lg font-bold text-white">Đặt thời gian học</h2>
        <div className="mb-4 flex gap-2">
          {[10, 25, 45].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setMinutes(preset)}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                minutes === preset ? "bg-[#7f56d9] text-white" : "bg-white/10 text-[#d9ecff] hover:bg-white/15"
              }`}
            >
              {preset} phút
            </button>
          ))}
        </div>
        <label className="mb-4 block text-sm text-[#b0b0d1]">
          Hoặc nhập số phút:
          <input
            type="number"
            min="1"
            max="180"
            value={minutes}
            onChange={(e) => setMinutes(Math.max(1, Number(e.target.value)))}
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-white focus:border-[#d9ecff] focus:outline-none"
          />
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-white/10 py-2 text-sm text-[#d9ecff] hover:bg-white/15">
            Hủy
          </button>
          <button type="button" onClick={handleStart} className="flex-1 rounded-xl bg-[#7f56d9] py-2 text-sm font-semibold text-white hover:bg-[#6941c6]">
            Bắt đầu
          </button>
        </div>
      </div>
    </div>
  );
}

function TimeUpModal() {
  const { countdownTarget, todaySeconds, startCountdown, clearTimeUp } = useTimer();
  const targetMinutes = Math.round((countdownTarget ?? 0) / 60);
  const studiedMinutes = Math.round(todaySeconds / 60);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true" aria-label="Hết giờ">
      <div className="w-80 rounded-2xl bg-[#2c1f4a] p-6 shadow-xl border border-white/10 text-center">
        <div className="mb-3 text-4xl" aria-hidden="true">🎉</div>
        <h2 className="mb-2 font-display text-lg font-bold text-white">Hết giờ rồi!</h2>
        <p className="mb-6 text-sm text-[#b0b0d1]">
          Bạn đã học <strong className="text-white">{studiedMinutes} phút</strong> hôm nay.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={clearTimeUp} className="flex-1 rounded-xl bg-white/10 py-2 text-sm text-[#d9ecff] hover:bg-white/15">
            Nghỉ thôi
          </button>
          {targetMinutes > 0 && (
            <button
              type="button"
              onClick={() => { startCountdown(countdownTarget!); }}
              className="flex-1 rounded-xl bg-[#7f56d9] py-2 text-sm font-semibold text-white hover:bg-[#6941c6]"
            >
              Học thêm {targetMinutes} phút
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HeaderTimer() {
  const { todaySeconds, isRunning, isCountdownMode, countdownRemaining, showTimeUp, pause, resume } = useTimer();
  const [showSetModal, setShowSetModal] = useState(false);

  const displaySeconds = isCountdownMode && countdownRemaining !== null ? countdownRemaining : todaySeconds;
  const icon = !isRunning ? "⏸" : isCountdownMode ? "⏳" : "⏱";

  return (
    <>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={isRunning ? pause : resume}
          className={`inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-lg px-2 font-mono text-sm font-medium transition-colors hover:bg-white/10 ${
            !isRunning ? "opacity-50 text-[#d9ecff]" : isCountdownMode ? "text-[#a78bfa]" : "text-[#d9ecff]"
          }`}
          aria-label={isRunning ? "Tạm dừng timer" : "Tiếp tục timer"}
        >
          {icon} {formatTime(displaySeconds)}
        </button>
        <button
          type="button"
          onClick={() => setShowSetModal(true)}
          className="inline-flex min-h-11 items-center px-1 text-sm text-[#b0b0d1] hover:text-white transition-colors"
          aria-label="Đặt countdown"
        >
          ＋
        </button>
      </div>
      {showSetModal && <SetCountdownModal onClose={() => setShowSetModal(false)} />}
      {showTimeUp && <TimeUpModal />}
    </>
  );
}
```

- [ ] **Step 2: Verify it compiles (no test file needed for this component — UI behavior is covered by TimerContext tests and manual verification)**

```bash
npm run build 2>&1 | head -30
```

Expected: No TypeScript errors referencing `HeaderTimer.tsx`

- [ ] **Step 3: Lint and commit**

```bash
npm run lint
git add src/components/HeaderTimer.tsx
git commit -m "feat: add HeaderTimer component with countdown and time-up modals"
```

---

### Task 4: Wire TimerContext and HeaderTimer into layout.tsx

**Files:**
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `TimerContextProvider` from `src/contexts/TimerContext.tsx`
- Consumes: `HeaderTimer` (default export) from `src/components/HeaderTimer.tsx`

- [ ] **Step 1: Update layout.tsx**

Replace `src/app/layout.tsx` with:

```tsx
import type { Metadata, Viewport } from "next";
import { Caladea, Inter } from "next/font/google";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import { SyncInitializer } from "@/components/SyncInitializer";
import { ProviderContextProvider } from "@/contexts/ProviderContext";
import { TimerContextProvider } from "@/contexts/TimerContext";
import { ProviderBadge } from "@/components/ProviderBadge";
import HeaderTimer from "@/components/HeaderTimer";
import { FirebaseInitializer } from "@/components/FirebaseInitializer";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const caladea = Caladea({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "English Study",
  description: "Website tự học tiếng Anh cá nhân",
  applicationName: "English Study",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "English Study",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2c1f4a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body
        className={`${inter.variable} ${caladea.variable} grid min-h-screen min-h-svh grid-rows-[auto_1fr_auto] bg-[#2c1f4a] font-sans text-white`}
      >
        <ProviderContextProvider>
          <TimerContextProvider>
            <nav className="sticky top-0 z-30 border-b border-white/10 bg-[#2c1f4a]/90 px-2 py-2 backdrop-blur sm:px-4 sm:py-3">
              <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 sm:flex-nowrap sm:justify-between sm:gap-6">
                <a
                  href="/"
                  className="inline-flex min-h-11 w-full items-center whitespace-nowrap px-1 font-display text-xl font-bold text-[#d9ecff] sm:w-auto sm:shrink-0 sm:text-2xl"
                >
                  English Study
                </a>
                <div className="flex w-full items-center justify-between gap-1 sm:w-auto sm:shrink-0 sm:gap-3">
                  <a
                    href="/"
                    className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm font-medium text-[#d9ecff] transition-colors hover:text-white"
                  >
                    Học từ mới
                  </a>
                  <a
                    href="/review"
                    className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm font-medium text-[#b0b0d1] transition-colors hover:text-white"
                  >
                    Ôn tập
                  </a>
                  <a
                    href="/history"
                    className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm font-medium text-[#b0b0d1] transition-colors hover:text-white"
                  >
                    Lịch sử
                  </a>
                  <a
                    href="/settings"
                    className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm font-medium text-[#b0b0d1] transition-colors hover:text-white"
                  >
                    Cài đặt
                  </a>
                  <ProviderBadge />
                  <HeaderTimer />
                </div>
              </div>
            </nav>
            {children}
            <footer className="border-t border-white/10 bg-[#2c1f4a] px-4 py-8 text-[#b0b0d1]">
              <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-display text-2xl font-bold text-[#d9ecff]">English Study</p>
                <p className="text-sm">Practice smarter vocabulary, one card at a time.</p>
              </div>
            </footer>
            <FirebaseInitializer />
            <ServiceWorkerRegistration />
            <SyncInitializer />
          </TimerContextProvider>
        </ProviderContextProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Run full test suite and build check**

```bash
npm test
npm run build 2>&1 | head -40
```

Expected: All tests pass, build succeeds

- [ ] **Step 3: Lint and commit**

```bash
npm run lint
git add src/app/layout.tsx
git commit -m "feat: wire TimerContext and HeaderTimer into app layout"
```

---

### Task 5: Stats Page — Study Time Chart and Tile

**Files:**
- Modify: `src/lib/stats.ts`
- Modify: `src/lib/__tests__/stats.test.ts`
- Create: `src/components/charts/StudyTimeChart.tsx`
- Modify: `src/app/stats/page.tsx`

**Interfaces:**
- Produces:
  ```ts
  // src/lib/stats.ts
  export interface DailyStudyTime { date: string; minutes: number; }
  export function getStudyTimePerDay(days?: number): DailyStudyTime[]
  ```
- Produces: `export default function StudyTimeChart({ data }: { data: DailyStudyTime[] }): JSX.Element`

- [ ] **Step 1: Write failing test for getStudyTimePerDay**

Add to `src/lib/__tests__/stats.test.ts` (after the existing imports add `getStudyTimePerDay` and `DailyStudyTime`):

```ts
import { getCalendarData, getStudyTimePerDay, getTopicDistribution, getWordsPerDay } from "../stats";
```

Then add these tests at the end of the file:

```ts
test("getStudyTimePerDay returns one entry per day with 0 minutes by default", () => {
  const result = getStudyTimePerDay(7);
  expect(result).toHaveLength(7);
  expect(result.every((d) => d.minutes === 0)).toBe(true);
});

test("getStudyTimePerDay converts seconds to rounded minutes", () => {
  jest.setSystemTime(new Date("2026-07-16T12:00:00.000Z"));
  localStorage.setItem("studyTime", JSON.stringify({
    "2026-07-16": 1830, // 30.5 min → rounds to 31
    "2026-07-15": 900,  // 15 min exactly
  }));
  const result = getStudyTimePerDay(3);
  expect(result.find((d) => d.date === "2026-07-16")?.minutes).toBe(31);
  expect(result.find((d) => d.date === "2026-07-15")?.minutes).toBe(15);
  expect(result.find((d) => d.date === "2026-07-14")?.minutes).toBe(0);
});

test("getStudyTimePerDay ignores dates outside range", () => {
  jest.setSystemTime(new Date("2026-07-16T12:00:00.000Z"));
  localStorage.setItem("studyTime", JSON.stringify({ "2026-01-01": 3600 }));
  const result = getStudyTimePerDay(7);
  expect(result.every((d) => d.minutes === 0)).toBe(true);
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npm test -- --testPathPattern=stats
```

Expected: FAIL — `getStudyTimePerDay is not a function`

- [ ] **Step 3: Implement getStudyTimePerDay in stats.ts**

Add to `src/lib/stats.ts` after the existing exports:

```ts
export interface DailyStudyTime {
  date: string;
  minutes: number;
}

export function getStudyTimePerDay(days = 30): DailyStudyTime[] {
  const safeDays = Number.isFinite(days) ? Math.max(0, Math.floor(days)) : 30;
  let data: Record<string, number> = {};
  if (typeof window !== "undefined") {
    try {
      data = JSON.parse(localStorage.getItem("studyTime") ?? "{}") as Record<string, number>;
    } catch {}
  }
  return Array.from({ length: safeDays }, (_, index) => {
    const date = formatDate(dateFromOffset(-(safeDays - 1 - index)));
    return { date, minutes: Math.round((data[date] ?? 0) / 60) };
  });
}
```

(Note: `formatDate` and `dateFromOffset` are already defined as private helpers in `stats.ts` — reuse them directly.)

- [ ] **Step 4: Run stats tests to confirm pass**

```bash
npm test -- --testPathPattern=stats
```

Expected: PASS (all tests)

- [ ] **Step 5: Create StudyTimeChart.tsx**

Create `src/components/charts/StudyTimeChart.tsx`:

```tsx
"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DailyStudyTime } from "@/lib/stats";

export default function StudyTimeChart({ data }: { data: DailyStudyTime[] }) {
  const displayData = data.map((day) => ({ ...day, label: day.date.slice(5) }));
  return (
    <section aria-labelledby="study-time-title">
      <h2 id="study-time-title" className="mb-3 font-semibold text-gray-700">
        Thời gian học mỗi ngày{" "}
        <span className="font-normal text-gray-400">(30 ngày gần nhất)</span>
      </h2>
      <div className="h-[220px] w-full" role="img" aria-label="Biểu đồ thời gian học theo ngày">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={displayData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid stroke="#f0f0f0" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={4} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value) => [value, "Phút"]}
              labelFormatter={(label) => `Ngày ${label}`}
            />
            <Bar dataKey="minutes" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Update Stats page**

Replace the full content of `src/app/stats/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import StreakCalendar from "@/components/StreakCalendar";
import TopicDistributionChart from "@/components/charts/TopicDistributionChart";
import WordsPerDayChart from "@/components/charts/WordsPerDayChart";
import StudyTimeChart from "@/components/charts/StudyTimeChart";
import { getCalendarData, getStudyTimePerDay, getTopicDistribution, getWordsPerDay, type CalendarDay, type DailyStudyTime, type DailyWordCount } from "@/lib/stats";
import { getLearnedWords } from "@/lib/storage";
import { useTimer } from "@/contexts/TimerContext";

export default function StatsPage() {
  const { todaySeconds } = useTimer();
  const [wordsPerDay, setWordsPerDay] = useState<DailyWordCount[]>([]);
  const [topicDistribution, setTopicDistribution] = useState<{ topic: string; count: number }[]>([]);
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([]);
  const [studyTimePerDay, setStudyTimePerDay] = useState<DailyStudyTime[]>([]);
  const [totalWords, setTotalWords] = useState(0);
  const [activeDays, setActiveDays] = useState(0);
  const [averageMastery, setAverageMastery] = useState(0);

  useEffect(() => {
    const daily = getWordsPerDay(30);
    const learned = getLearnedWords();
    setWordsPerDay(daily);
    setTopicDistribution(getTopicDistribution());
    setCalendarData(getCalendarData(26));
    setStudyTimePerDay(getStudyTimePerDay(30));
    setTotalWords(learned.length);
    setActiveDays(daily.filter((day) => day.count > 0).length);
    setAverageMastery(
      learned.length
        ? Math.round((learned.reduce((total, word) => total + (word.mastery ?? 0), 0) / learned.length) * 10) / 10
        : 0
    );
  }, []);

  const todayMinutes = Math.round(todaySeconds / 60);

  return (
    <main className="min-h-full bg-[#f7f4ff] px-4 py-10 text-[#2c1f4a] sm:px-6 lg:py-14">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7f56d9]">Learning analytics</p>
          <h1 className="mt-2 font-display text-4xl font-bold">Thống kê học tập</h1>
          <p className="mt-2 text-sm text-[#6b6384]">Theo dõi nhịp học, chủ đề và tiến bộ mastery của bạn.</p>
        </div>
        <div className="mb-6 grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="font-display text-3xl font-bold">{totalWords}</p>
            <p className="mt-1 text-sm text-[#6b6384]">Từ đã học</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="font-display text-3xl font-bold">{activeDays}</p>
            <p className="mt-1 text-sm text-[#6b6384]">Ngày học trong 30 ngày</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="font-display text-3xl font-bold">{averageMastery}/5</p>
            <p className="mt-1 text-sm text-[#6b6384]">Mastery trung bình</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="font-display text-3xl font-bold">{todayMinutes} phút</p>
            <p className="mt-1 text-sm text-[#6b6384]">Hôm nay</p>
          </div>
        </div>
        <div className="space-y-6">
          <section className="rounded-[28px] bg-white p-5 shadow-sm sm:p-6">
            <WordsPerDayChart data={wordsPerDay} />
          </section>
          <section className="rounded-[28px] bg-white p-5 shadow-sm sm:p-6">
            <StudyTimeChart data={studyTimePerDay} />
          </section>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-[28px] bg-white p-5 shadow-sm sm:p-6">
              <TopicDistributionChart data={topicDistribution} />
            </section>
            <section className="rounded-[28px] bg-white p-5 shadow-sm sm:p-6">
              <h2 className="mb-3 font-semibold text-gray-700">Tóm tắt theo chủ đề</h2>
              {topicDistribution.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">Chưa có dữ liệu</p>
              ) : (
                <ul className="space-y-3">
                  {topicDistribution.map((item) => (
                    <li key={item.topic} className="flex items-center justify-between border-b border-gray-100 pb-2 text-sm last:border-0">
                      <span className="text-gray-600">{item.topic}</span>
                      <span className="font-semibold text-[#2c1f4a]">{item.count} từ</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <section className="rounded-[28px] bg-white p-5 shadow-sm sm:p-6">
            <StreakCalendar data={calendarData} />
          </section>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Run full test suite**

```bash
npm test
```

Expected: All tests pass

- [ ] **Step 8: Build check**

```bash
npm run build 2>&1 | head -40
```

Expected: Build succeeds with no TypeScript errors

- [ ] **Step 9: Lint and commit**

```bash
npm run lint
git add src/lib/stats.ts src/lib/__tests__/stats.test.ts src/components/charts/StudyTimeChart.tsx src/app/stats/page.tsx
git commit -m "feat: add study time chart and tile to stats page"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| TimerContext with full state shape | Task 2 |
| localStorage key `"studyTime"` as `Record<string, number>` | Task 2 |
| 5s debounce on writes | Task 2 |
| `isRunning`, `pause`, `resume` | Task 2 |
| `startCountdown`, `stopCountdown`, countdown decrement | Task 2 |
| `showTimeUp` on countdown reaching 0 | Task 2 |
| HeaderTimer in navbar with pause/resume click | Task 3 + 4 |
| Normal mode display `⏱ MM:SS` | Task 3 |
| Countdown mode display `⏳ MM:SS` in accent color | Task 3 |
| Paused display at reduced opacity | Task 3 |
| SetCountdownModal with presets (10, 25, 45) + custom input | Task 3 |
| TimeUpModal with today's minutes + "Nghỉ thôi" + "Học thêm X phút" | Task 3 |
| Wrap layout.tsx with TimerContextProvider | Task 4 |
| `getStudyTimePerDay()` in stats.ts | Task 5 |
| StudyTimeChart bar chart component | Task 5 |
| 4th tile "Hôm nay" on Stats page reading from TimerContext | Task 5 |
| `deleteCustomTopic()` function | Task 1 |
| × delete button on custom topic pills only | Task 1 |
| Selecting first built-in topic when deleting current | Task 1 |

All spec requirements covered. ✓
