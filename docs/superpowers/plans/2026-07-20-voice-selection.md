# Voice Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép người dùng chọn giọng đọc và điều chỉnh rate/pitch/volume, lưu trong localStorage và sync qua Supabase.

**Architecture:** Custom hook `useVoiceSettings` là nguồn sự thật duy nhất — `PronunciationButton` và `DictationMode` đều consume hook này thay vì hardcode. Settings được persist vào localStorage và push/pull qua bảng `user_settings` trong Supabase. Trang `/settings` được refactor thành 3 tab: AI Providers, Voice, Sync.

**Tech Stack:** Next.js 14 App Router, TypeScript, Web Speech API (`SpeechSynthesisUtterance`), Supabase (JSONB column), Jest + React Testing Library.

## Global Constraints

- `voiceURI: null` luôn là fallback hợp lệ (giọng mặc định hệ thống)
- Guard `typeof window === "undefined"` bắt buộc cho mọi Web Speech API call
- Chỉ liệt kê giọng có `lang.startsWith("en")` trong dropdown
- Conflict resolution cho voice sync: last-write-wins
- Không thêm dependency npm mới

---

## File Map

| Action | File | Trách nhiệm |
|--------|------|-------------|
| Create | `src/lib/voiceSettings.ts` | Type `VoiceSettings`, `DEFAULT_VOICE_SETTINGS`, `getVoiceSettings()`, `saveVoiceSettings()` |
| Create | `src/lib/__tests__/voiceSettings.test.ts` | Tests cho voiceSettings.ts |
| Create | `src/lib/useVoiceSettings.ts` | Hook `useVoiceSettings()` trả về `{ settings, update }` |
| Create | `src/lib/__tests__/useVoiceSettings.test.ts` | Tests cho hook |
| Create | `src/components/VoiceSettingsTab.tsx` | UI: dropdown giọng + 3 sliders + nút test + reset |
| Create | `src/components/__tests__/VoiceSettingsTab.test.tsx` | Tests cho VoiceSettingsTab |
| Create | `supabase/migrations/004_voice_settings.sql` | Tạo bảng `user_settings` |
| Modify | `src/lib/sync.ts` | Push/pull `voice_settings` qua Supabase |
| Modify | `src/lib/__tests__/sync.test.ts` | Extend tests cho voice settings sync |
| Modify | `src/components/PronunciationButton.tsx` | Consume `useVoiceSettings` thay vì hardcode |
| Modify | `src/components/DictationMode.tsx` | Consume `useVoiceSettings` thay vì hardcode |
| Modify | `src/app/settings/page.tsx` | Refactor thành 3 tab: Providers / Voice / Sync |

---

## Task 1: Voice settings data layer

**Files:**
- Create: `src/lib/voiceSettings.ts`
- Create: `src/lib/__tests__/voiceSettings.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface VoiceSettings { voiceURI: string | null; rate: number; pitch: number; volume: number; }
  const DEFAULT_VOICE_SETTINGS: VoiceSettings
  function getVoiceSettings(): VoiceSettings
  function saveVoiceSettings(settings: VoiceSettings): void
  ```

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/__tests__/voiceSettings.test.ts
import { DEFAULT_VOICE_SETTINGS, getVoiceSettings, saveVoiceSettings } from "../voiceSettings";

beforeEach(() => {
  localStorage.clear();
});

test("getVoiceSettings returns defaults when nothing saved", () => {
  expect(getVoiceSettings()).toEqual(DEFAULT_VOICE_SETTINGS);
});

test("saveVoiceSettings persists settings", () => {
  const settings = { voiceURI: "test-uri", rate: 1.2, pitch: 0.8, volume: 0.5 };
  saveVoiceSettings(settings);
  expect(getVoiceSettings()).toEqual(settings);
});

test("getVoiceSettings merges with defaults on partial data", () => {
  localStorage.setItem("voiceSettings", JSON.stringify({ rate: 1.5 }));
  const result = getVoiceSettings();
  expect(result.rate).toBe(1.5);
  expect(result.voiceURI).toBeNull();
  expect(result.pitch).toBe(DEFAULT_VOICE_SETTINGS.pitch);
  expect(result.volume).toBe(DEFAULT_VOICE_SETTINGS.volume);
});

test("getVoiceSettings returns defaults when JSON is corrupt", () => {
  localStorage.setItem("voiceSettings", "not-json");
  expect(getVoiceSettings()).toEqual(DEFAULT_VOICE_SETTINGS);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=voiceSettings
```

Expected: FAIL — `Cannot find module '../voiceSettings'`

- [ ] **Step 3: Implement voiceSettings.ts**

```ts
// src/lib/voiceSettings.ts
export interface VoiceSettings {
  voiceURI: string | null;
  rate: number;
  pitch: number;
  volume: number;
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  voiceURI: null,
  rate: 0.9,
  pitch: 1.0,
  volume: 1.0,
};

const KEY = "voiceSettings";

export function getVoiceSettings(): VoiceSettings {
  if (typeof window === "undefined") return { ...DEFAULT_VOICE_SETTINGS };
  const raw = localStorage.getItem(KEY);
  if (!raw) return { ...DEFAULT_VOICE_SETTINGS };
  try {
    return { ...DEFAULT_VOICE_SETTINGS, ...(JSON.parse(raw) as Partial<VoiceSettings>) };
  } catch {
    return { ...DEFAULT_VOICE_SETTINGS };
  }
}

export function saveVoiceSettings(settings: VoiceSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(settings));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=voiceSettings
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/voiceSettings.ts src/lib/__tests__/voiceSettings.test.ts
git commit -m "feat: add voiceSettings data layer with localStorage persistence"
```

---

## Task 2: useVoiceSettings hook

**Files:**
- Create: `src/lib/useVoiceSettings.ts`
- Create: `src/lib/__tests__/useVoiceSettings.test.ts`

**Interfaces:**
- Consumes: `getVoiceSettings()`, `saveVoiceSettings()`, `VoiceSettings` from `./voiceSettings`
- Produces:
  ```ts
  function useVoiceSettings(): { settings: VoiceSettings; update: (partial: Partial<VoiceSettings>) => void }
  ```

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/__tests__/useVoiceSettings.test.ts
import { renderHook, act } from "@testing-library/react";
import { useVoiceSettings } from "../useVoiceSettings";
import { DEFAULT_VOICE_SETTINGS } from "../voiceSettings";

beforeEach(() => {
  localStorage.clear();
});

test("initial settings come from localStorage (defaults when empty)", () => {
  const { result } = renderHook(() => useVoiceSettings());
  expect(result.current.settings).toEqual(DEFAULT_VOICE_SETTINGS);
});

test("initial settings reflect existing localStorage value", () => {
  localStorage.setItem("voiceSettings", JSON.stringify({ ...DEFAULT_VOICE_SETTINGS, rate: 1.5 }));
  const { result } = renderHook(() => useVoiceSettings());
  expect(result.current.settings.rate).toBe(1.5);
});

test("update() merges partial settings into state", () => {
  const { result } = renderHook(() => useVoiceSettings());
  act(() => { result.current.update({ rate: 1.5 }); });
  expect(result.current.settings.rate).toBe(1.5);
  expect(result.current.settings.pitch).toBe(DEFAULT_VOICE_SETTINGS.pitch);
});

test("update() persists to localStorage", () => {
  const { result } = renderHook(() => useVoiceSettings());
  act(() => { result.current.update({ rate: 1.2, voiceURI: "test-uri" }); });
  const saved = JSON.parse(localStorage.getItem("voiceSettings")!);
  expect(saved.rate).toBe(1.2);
  expect(saved.voiceURI).toBe("test-uri");
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=useVoiceSettings
```

Expected: FAIL — `Cannot find module '../useVoiceSettings'`

- [ ] **Step 3: Implement useVoiceSettings.ts**

```ts
// src/lib/useVoiceSettings.ts
"use client";

import { useState } from "react";
import { type VoiceSettings, getVoiceSettings, saveVoiceSettings } from "./voiceSettings";

export function useVoiceSettings() {
  const [settings, setSettings] = useState<VoiceSettings>(() => getVoiceSettings());

  function update(partial: Partial<VoiceSettings>) {
    const next = { ...settings, ...partial };
    setSettings(next);
    saveVoiceSettings(next);
  }

  return { settings, update };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=useVoiceSettings
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/useVoiceSettings.ts src/lib/__tests__/useVoiceSettings.test.ts
git commit -m "feat: add useVoiceSettings hook"
```

---

## Task 3: VoiceSettingsTab component

**Files:**
- Create: `src/components/VoiceSettingsTab.tsx`
- Create: `src/components/__tests__/VoiceSettingsTab.test.tsx`

**Interfaces:**
- Consumes: `useVoiceSettings()` from `@/lib/useVoiceSettings`, `DEFAULT_VOICE_SETTINGS` from `@/lib/voiceSettings`
- Produces: `export default function VoiceSettingsTab(): JSX.Element`

- [ ] **Step 1: Write failing tests**

```tsx
// src/components/__tests__/VoiceSettingsTab.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import VoiceSettingsTab from "../VoiceSettingsTab";
import { DEFAULT_VOICE_SETTINGS } from "@/lib/voiceSettings";

const mockUpdate = jest.fn();
jest.mock("@/lib/useVoiceSettings", () => ({
  useVoiceSettings: () => ({ settings: DEFAULT_VOICE_SETTINGS, update: mockUpdate }),
}));

const mockSpeak = jest.fn();
const mockCancel = jest.fn();
const mockGetVoices = jest.fn().mockReturnValue([
  { voiceURI: "voice-1", name: "Samantha", lang: "en-US", localService: true },
  { voiceURI: "voice-2", name: "Google UK English", lang: "en-GB", localService: false },
]);

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(window, "speechSynthesis", {
    value: {
      getVoices: mockGetVoices,
      speak: mockSpeak,
      cancel: mockCancel,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
    writable: true,
    configurable: true,
  });
});

test("renders voice dropdown with system default option", () => {
  render(<VoiceSettingsTab />);
  expect(screen.getByRole("combobox")).toBeInTheDocument();
  expect(screen.getByText("Mặc định hệ thống")).toBeInTheDocument();
});

test("renders english voices in dropdown", () => {
  render(<VoiceSettingsTab />);
  expect(screen.getByText("Samantha · Offline")).toBeInTheDocument();
  expect(screen.getByText("Google UK English · Online")).toBeInTheDocument();
});

test("renders three slider labels", () => {
  render(<VoiceSettingsTab />);
  expect(screen.getByText("Tốc độ (Rate)")).toBeInTheDocument();
  expect(screen.getByText("Cao độ (Pitch)")).toBeInTheDocument();
  expect(screen.getByText("Âm lượng (Volume)")).toBeInTheDocument();
});

test("test button calls speechSynthesis.speak", () => {
  render(<VoiceSettingsTab />);
  fireEvent.click(screen.getByRole("button", { name: "Thử nghe" }));
  expect(mockSpeak).toHaveBeenCalledTimes(1);
  expect(mockCancel).toHaveBeenCalledTimes(1);
});

test("reset button calls update with DEFAULT_VOICE_SETTINGS", () => {
  render(<VoiceSettingsTab />);
  fireEvent.click(screen.getByRole("button", { name: "Reset về mặc định" }));
  expect(mockUpdate).toHaveBeenCalledWith(DEFAULT_VOICE_SETTINGS);
});

test("selecting a voice calls update with voiceURI", () => {
  render(<VoiceSettingsTab />);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "voice-1" } });
  expect(mockUpdate).toHaveBeenCalledWith({ voiceURI: "voice-1" });
});

test("selecting system default calls update with voiceURI null", () => {
  render(<VoiceSettingsTab />);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });
  expect(mockUpdate).toHaveBeenCalledWith({ voiceURI: null });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=VoiceSettingsTab
```

Expected: FAIL — `Cannot find module '../VoiceSettingsTab'`

- [ ] **Step 3: Implement VoiceSettingsTab.tsx**

```tsx
// src/components/VoiceSettingsTab.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useVoiceSettings } from "@/lib/useVoiceSettings";
import { DEFAULT_VOICE_SETTINGS } from "@/lib/voiceSettings";

const SLIDERS = [
  { field: "rate" as const, label: "Tốc độ (Rate)", min: 0.5, max: 2.0, step: 0.1 },
  { field: "pitch" as const, label: "Cao độ (Pitch)", min: 0.5, max: 2.0, step: 0.1 },
  { field: "volume" as const, label: "Âm lượng (Volume)", min: 0.0, max: 1.0, step: 0.1 },
];

export default function VoiceSettingsTab() {
  const { settings, update } = useVoiceSettings();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [sliders, setSliders] = useState({
    rate: settings.rate,
    pitch: settings.pitch,
    volume: settings.volume,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    function loadVoices() {
      setVoices(window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en")));
    }
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  function handleSlider(field: "rate" | "pitch" | "volume", value: number) {
    setSliders((prev) => ({ ...prev, [field]: value }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => update({ [field]: value }), 300);
  }

  function handleTest() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("Hello, this is a test.");
    const voice = voices.find((v) => v.voiceURI === settings.voiceURI) ?? null;
    if (voice) utterance.voice = voice;
    utterance.rate = sliders.rate;
    utterance.pitch = sliders.pitch;
    utterance.volume = sliders.volume;
    window.speechSynthesis.speak(utterance);
  }

  function handleReset() {
    setSliders({
      rate: DEFAULT_VOICE_SETTINGS.rate,
      pitch: DEFAULT_VOICE_SETTINGS.pitch,
      volume: DEFAULT_VOICE_SETTINGS.volume,
    });
    update(DEFAULT_VOICE_SETTINGS);
  }

  return (
    <div className="space-y-8">
      <div>
        <label className="mb-2 block text-sm font-medium text-[#d9ecff]">Giọng đọc</label>
        <div className="flex gap-3">
          <select
            value={settings.voiceURI ?? ""}
            onChange={(e) => update({ voiceURI: e.target.value || null })}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
          >
            <option value="">Mặc định hệ thống</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} · {v.localService ? "Offline" : "Online"}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleTest}
            className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-[#d9ecff] hover:bg-white/20"
          >
            Thử nghe
          </button>
        </div>
      </div>

      {SLIDERS.map(({ field, label, min, max, step }) => (
        <div key={field}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-[#d9ecff]">{label}</span>
            <span className="text-sm text-[#b0b0d1]">{sliders[field].toFixed(1)}</span>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={sliders[field]}
            onChange={(e) => handleSlider(field, parseFloat(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>
      ))}

      <button
        type="button"
        onClick={handleReset}
        className="rounded-lg border border-white/10 px-4 py-2 text-sm text-[#b0b0d1] hover:bg-white/5"
      >
        Reset về mặc định
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=VoiceSettingsTab
```

Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/VoiceSettingsTab.tsx src/components/__tests__/VoiceSettingsTab.test.tsx
git commit -m "feat: add VoiceSettingsTab component"
```

---

## Task 4: Supabase migration + sync update

**Files:**
- Create: `supabase/migrations/004_voice_settings.sql`
- Modify: `src/lib/sync.ts`
- Modify: `src/lib/__tests__/sync.test.ts`

**Interfaces:**
- Consumes: `getVoiceSettings()`, `saveVoiceSettings()`, `VoiceSettings` from `./voiceSettings`
- New Supabase table: `user_settings(sync_key UUID PRIMARY KEY, voice_settings JSONB)`

- [ ] **Step 1: Create Supabase migration**

```sql
-- supabase/migrations/004_voice_settings.sql
CREATE TABLE IF NOT EXISTS user_settings (
  sync_key       UUID NOT NULL PRIMARY KEY,
  voice_settings JSONB DEFAULT NULL
);

ALTER TABLE user_settings DISABLE ROW LEVEL SECURITY;
```

**Apply this migration to your Supabase project:**
```bash
# Option A — Supabase CLI (if configured):
npx supabase db push

# Option B — Supabase dashboard SQL editor:
# Copy the SQL above and run it directly.
```

- [ ] **Step 2: Write failing tests for sync voice settings**

Add these tests at the end of `src/lib/__tests__/sync.test.ts`.

First, extend the `makeFromImpl` helper at the top of the file to handle `user_settings`:

```ts
// Replace the existing makeFromImpl function with this updated version:
function makeFromImpl(
  words: unknown[] = [],
  topics: unknown[] = [],
  challenges: unknown[] = [],
  error: unknown = null,
  userSettings: unknown = null,
) {
  return (table: string) => {
    if (table === "user_settings") {
      return {
        upsert: jest.fn().mockResolvedValue({ data: null, error }),
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: userSettings, error }),
          })),
        })),
      };
    }
    const data = table === "learned_words" ? words
               : table === "custom_topics" ? topics
               : challenges;
    return {
      upsert: jest.fn().mockResolvedValue({ data: null, error }),
      delete: jest.fn(() => ({
        match: jest.fn().mockResolvedValue({ data: null, error }),
      })),
      select: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ data: error ? null : data, error }),
      })),
    };
  };
}
```

Then add these new tests at the bottom:

```ts
// --- voice settings sync ---

test("initSync pushes voiceSettings to user_settings table", async () => {
  localStorage.setItem("voiceSettings", JSON.stringify({ voiceURI: null, rate: 1.2, pitch: 1.0, volume: 0.8 }));
  const upsertMock = jest.fn().mockResolvedValue({ data: null, error: null });
  mockFrom.mockImplementation((table: string) => {
    if (table === "user_settings") {
      return {
        upsert: upsertMock,
        select: jest.fn(() => ({ eq: jest.fn(() => ({ single: jest.fn().mockResolvedValue({ data: null, error: null }) })) })),
      };
    }
    return {
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
      select: jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ data: [], error: null }) })),
    };
  });
  await initSync();
  expect(upsertMock).toHaveBeenCalledWith(
    expect.objectContaining({ voice_settings: expect.objectContaining({ rate: 1.2 }) })
  );
});

test("initSync applies pulled voice_settings when voiceURI is null", async () => {
  const remoteSettings = { voiceURI: null, rate: 1.5, pitch: 0.8, volume: 0.9 };
  mockFrom.mockImplementation(makeFromImpl([], [], [], null, { voice_settings: remoteSettings }));
  await initSync();
  const saved = JSON.parse(localStorage.getItem("voiceSettings")!);
  expect(saved.rate).toBe(1.5);
  expect(saved.voiceURI).toBeNull();
});

test("pullFromKey applies voice_settings from remote key", async () => {
  const remoteSettings = { voiceURI: null, rate: 1.3, pitch: 1.1, volume: 1.0 };
  mockFrom.mockImplementation(makeFromImpl([], [], [], null, { voice_settings: remoteSettings }));
  await pullFromKey("7468616e-6b7a-4000-8000-000000000000");
  const saved = JSON.parse(localStorage.getItem("voiceSettings")!);
  expect(saved.rate).toBe(1.3);
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=sync.test
```

Expected: FAIL on the 3 new voice settings tests.

- [ ] **Step 4: Update sync.ts**

Add import at the top of `src/lib/sync.ts` (after existing imports):

```ts
import { getVoiceSettings, saveVoiceSettings, type VoiceSettings } from "./voiceSettings";
```

Inside `initSync`, add this block after the `remoteChallenges` block (before `setLastSyncedAt()`):

```ts
    // Push voice settings
    await supabase.from("user_settings").upsert({
      sync_key: syncKey,
      voice_settings: getVoiceSettings(),
    });

    // Pull voice settings
    const { data: remoteUserSettings } = await supabase
      .from("user_settings")
      .select("voice_settings")
      .eq("sync_key", syncKey)
      .single();

    if (remoteUserSettings?.voice_settings) {
      const remote = remoteUserSettings.voice_settings as VoiceSettings;
      const availableURIs =
        typeof window !== "undefined" && window.speechSynthesis
          ? window.speechSynthesis.getVoices().map((v) => v.voiceURI)
          : [];
      const voiceURI =
        remote.voiceURI && availableURIs.includes(remote.voiceURI) ? remote.voiceURI : null;
      saveVoiceSettings({ ...remote, voiceURI });
    }
```

Inside `pullFromKey`, add this block at the end (after the `challengesResult` block, before `return newWordsCount`):

```ts
  const settingsResult = await supabase
    .from("user_settings")
    .select("voice_settings")
    .eq("sync_key", resolved)
    .single();

  if (!settingsResult.error && settingsResult.data?.voice_settings) {
    const remote = settingsResult.data.voice_settings as VoiceSettings;
    const availableURIs =
      window.speechSynthesis
        ? window.speechSynthesis.getVoices().map((v) => v.voiceURI)
        : [];
    const voiceURI =
      remote.voiceURI && availableURIs.includes(remote.voiceURI) ? remote.voiceURI : null;
    saveVoiceSettings({ ...remote, voiceURI });
  }
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=sync.test
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/004_voice_settings.sql src/lib/sync.ts src/lib/__tests__/sync.test.ts
git commit -m "feat: add user_settings table and sync voice settings via Supabase"
```

---

## Task 5: Update PronunciationButton + DictationMode

**Files:**
- Modify: `src/components/PronunciationButton.tsx`
- Modify: `src/components/DictationMode.tsx`
- Modify: `src/components/__tests__/Flashcard.test.tsx` (add mock for useVoiceSettings)

**Interfaces:**
- Consumes: `useVoiceSettings()` from `@/lib/useVoiceSettings`

- [ ] **Step 1: Add useVoiceSettings mock to Flashcard test (prevents test breakage)**

In `src/components/__tests__/Flashcard.test.tsx`, add this mock near the top (after existing mocks):

```ts
jest.mock("@/lib/useVoiceSettings", () => ({
  useVoiceSettings: () => ({
    settings: { voiceURI: null, rate: 0.9, pitch: 1.0, volume: 1.0 },
    update: jest.fn(),
  }),
}));
```

- [ ] **Step 2: Update PronunciationButton.tsx**

Replace the entire file content:

```tsx
// src/components/PronunciationButton.tsx
"use client";

import { useVoiceSettings } from "@/lib/useVoiceSettings";

interface Props {
  word: string;
}

export default function PronunciationButton({ word }: Props) {
  const { settings } = useVoiceSettings();

  function speak() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const voices = window.speechSynthesis.getVoices();
    const utterance = new SpeechSynthesisUtterance(word);
    const voice = voices.find((v) => v.voiceURI === settings.voiceURI) ?? null;
    if (voice) utterance.voice = voice;
    utterance.lang = "en-US";
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    utterance.volume = settings.volume;
    window.speechSynthesis.speak(utterance);
  }

  return (
    <button
      type="button"
      aria-label={`Nghe phát âm ${word}`}
      onClick={(e) => {
        e.stopPropagation();
        speak();
      }}
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-blue-50 hover:text-blue-700"
      title="Nghe phát âm"
    >
      🔊
    </button>
  );
}
```

- [ ] **Step 3: Update DictationMode.tsx**

Add import after the existing `import { useState } from "react"`:

```ts
import { useVoiceSettings } from "@/lib/useVoiceSettings";
```

Inside `DictationMode`, add after the existing `useState` calls:

```ts
  const { settings } = useVoiceSettings();
```

Replace the existing `speak()` function:

```ts
  function speak() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const voices = window.speechSynthesis.getVoices();
    const utterance = new SpeechSynthesisUtterance(sentence);
    const voice = voices.find((v) => v.voiceURI === settings.voiceURI) ?? null;
    if (voice) utterance.voice = voice;
    utterance.lang = "en-US";
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    utterance.volume = settings.volume;
    utterance.onstart = () => setPlaying(true);
    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => setPlaying(false);
    window.speechSynthesis.speak(utterance);
  }
```

- [ ] **Step 4: Add useVoiceSettings mock to DictationMode test**

In `src/components/__tests__/DictationMode.test.tsx`, add near the top:

```ts
jest.mock("@/lib/useVoiceSettings", () => ({
  useVoiceSettings: () => ({
    settings: { voiceURI: null, rate: 0.9, pitch: 1.0, volume: 1.0 },
    update: jest.fn(),
  }),
}));
```

- [ ] **Step 5: Run all component tests**

```bash
npm test -- --testPathPattern="PronunciationButton|DictationMode|Flashcard"
```

Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/PronunciationButton.tsx src/components/DictationMode.tsx src/components/__tests__/Flashcard.test.tsx src/components/__tests__/DictationMode.test.tsx
git commit -m "feat: use voiceSettings hook in PronunciationButton and DictationMode"
```

---

## Task 6: Refactor settings page with tab navigation

**Files:**
- Modify: `src/app/settings/page.tsx`

**Interfaces:**
- Consumes: `VoiceSettingsTab` from `@/components/VoiceSettingsTab`

- [ ] **Step 1: Update settings/page.tsx**

Replace the entire file with the following (the providers table and sync section content are preserved verbatim — only the wrapper structure changes):

```tsx
// src/app/settings/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useProvider } from "@/contexts/ProviderContext";
import { getSyncKey, getLastSyncedAt, pullFromKey } from "@/lib/sync";
import VoiceSettingsTab from "@/components/VoiceSettingsTab";

const ALL_PROVIDERS = [
  { id: "gemini",      name: "Gemini Flash", model: "gemini-flash-latest",                         envKey: "GEMINI_API_KEY" },
  { id: "groq",        name: "Groq",         model: "llama-3.3-70b-versatile",                     envKey: "GROQ_API_KEY" },
  { id: "openrouter",  name: "OpenRouter",   model: "nvidia/nemotron-3-nano-30b-a3b:free",          envKey: "OPENROUTER_API_KEY" },
  { id: "mistral",     name: "Mistral",      model: "mistral-small-latest",                         envKey: "MISTRAL_API_KEY" },
  { id: "cohere",      name: "Cohere",       model: "command-r7b-12-2024",                          envKey: "COHERE_API_KEY" },
  { id: "huggingface", name: "HuggingFace",  model: "meta-llama/Llama-3.2-1B-Instruct",            envKey: "HUGGINGFACE_API_KEY" },
];

type TestResult = "loading" | { ok: boolean; latency?: number; error?: string };
type Tab = "providers" | "voice" | "sync";

export default function SettingsPage() {
  const { currentProvider, availableProviders, setProvider, disabledProviders, toggleProvider } =
    useProvider();
  const [activeTab, setActiveTab] = useState<Tab>("providers");
  const [syncKey, setSyncKey] = useState("");
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [pullInput, setPullInput] = useState("");
  const [pulling, setPulling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pullSuccess, setPullSuccess] = useState<string | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  useEffect(() => {
    setSyncKey(getSyncKey());
    setLastSynced(getLastSyncedAt());
  }, []);

  const isActive = (id: string) => availableProviders.some((p) => p.id === id);
  const isDisabled = (id: string) => disabledProviders.includes(id);

  function handleCopy() {
    navigator.clipboard.writeText(syncKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  async function handlePull() {
    const trimmed = pullInput.trim();
    if (!trimmed) return;
    setPulling(true);
    setPullSuccess(null);
    setPullError(null);
    try {
      const count = await pullFromKey(trimmed);
      setPullSuccess(
        count > 0 ? `${count} từ mới được thêm vào thiết bị này.` : "Đồng bộ xong. Không có từ mới."
      );
      setPullInput("");
    } catch {
      setPullError("Không thể kết nối. Kiểm tra kết nối mạng và thử lại.");
    } finally {
      setPulling(false);
    }
  }

  async function handleTest(id: string) {
    setTestResults((prev) => ({ ...prev, [id]: "loading" }));
    try {
      const res = await fetch("/api/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: id }),
      });
      const data = (await res.json()) as { ok: boolean; latency: number; error?: string };
      setTestResults((prev) => ({ ...prev, [id]: data }));
    } catch {
      setTestResults((prev) => ({ ...prev, [id]: { ok: false, error: "Network error" } }));
    }
    setTimeout(() => {
      setTestResults((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, 5000);
  }

  function formatSynced(iso: string | null) {
    if (!iso) return "Chưa đồng bộ";
    const d = new Date(iso);
    return `Đã đồng bộ lúc ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }

  function renderTestResult(id: string) {
    const result = testResults[id];
    if (!result) return null;
    if (result === "loading") return <span className="text-xs text-[#b0b0d1]">Testing…</span>;
    if (result.ok) return <span className="text-xs text-green-400">✅ {result.latency}ms</span>;
    return <span className="text-xs text-red-400">❌ {result.error ?? "Error"}</span>;
  }

  const TAB_LABELS: Record<Tab, string> = { providers: "AI Providers", voice: "Voice", sync: "Sync" };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-8">
      <div>
        <h1 className="mb-6 font-display text-3xl font-bold text-[#d9ecff]">Cài đặt</h1>

        <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1 w-fit mb-8">
          {(["providers", "voice", "sync"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-white/15 text-[#d9ecff]"
                  : "text-[#b0b0d1] hover:text-[#d9ecff]"
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "providers" && (
        <div>
          <p className="mb-8 text-sm text-[#b0b0d1]">
            Quản lý AI provider. Provider được kích hoạt khi có API key trong{" "}
            <code className="rounded bg-white/10 px-1">.env.local</code>.
          </p>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-left">
                  <th className="px-4 py-3 font-semibold text-[#d9ecff]">Provider</th>
                  <th className="px-4 py-3 font-semibold text-[#d9ecff]">Model</th>
                  <th className="px-4 py-3 font-semibold text-[#d9ecff]">Trạng thái</th>
                  <th className="px-4 py-3 font-semibold text-[#d9ecff]">Bật/Tắt</th>
                  <th className="px-4 py-3 font-semibold text-[#d9ecff]">Test</th>
                  <th className="px-4 py-3 font-semibold text-[#d9ecff]">Ưu tiên</th>
                </tr>
              </thead>
              <tbody>
                {ALL_PROVIDERS.map((p) => {
                  const active = isActive(p.id);
                  const disabled = isDisabled(p.id);
                  const isCurrent = p.id === currentProvider;
                  const testResult = testResults[p.id];

                  return (
                    <tr key={p.id} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-4 font-medium text-white">{p.name}</td>
                      <td className="px-4 py-4 font-mono text-xs text-[#b0b0d1]">
                        {active
                          ? (availableProviders.find((ap) => ap.id === p.id)?.model ?? p.model)
                          : p.model}
                      </td>
                      <td className="px-4 py-4">
                        {active ? (
                          <span className="inline-flex items-center gap-1 text-green-400">✅ Active</span>
                        ) : (
                          <span className="text-xs text-[#b0b0d1]">
                            <code className="rounded bg-white/5 px-1">{p.envKey}</code>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => active && toggleProvider(p.id)}
                          disabled={!active}
                          title={active ? (disabled ? "Bật provider này" : "Tắt provider này") : "Chưa cấu hình"}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                            !active
                              ? "cursor-not-allowed opacity-30 bg-white/10"
                              : disabled
                              ? "bg-white/20"
                              : "bg-green-600 hover:bg-green-500"
                          }`}
                        >
                          <span
                            className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                              !disabled ? "translate-x-5" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {active && !testResult && (
                            <button
                              onClick={() => void handleTest(p.id)}
                              className="rounded-lg bg-white/10 px-2 py-1 text-xs font-medium text-[#d9ecff] hover:bg-white/20"
                            >
                              Test
                            </button>
                          )}
                          {renderTestResult(p.id)}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {active && !disabled ? (
                          isCurrent ? (
                            <span className="text-[#d9ecff]">✓ Đang dùng</span>
                          ) : (
                            <button
                              onClick={() => setProvider(p.id)}
                              className="rounded-lg bg-white/10 px-3 py-1 text-xs font-medium text-[#d9ecff] hover:bg-white/20"
                            >
                              Dùng cái này
                            </button>
                          )
                        ) : (
                          <span className="text-xs text-[#b0b0d1]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "voice" && (
        <div>
          <p className="mb-8 text-sm text-[#b0b0d1]">
            Chọn giọng đọc và điều chỉnh thông số phát âm.
          </p>
          <div className="rounded-xl border border-white/10 p-6">
            <VoiceSettingsTab />
          </div>
        </div>
      )}

      {activeTab === "sync" && (
        <div>
          <h2 className="mb-2 font-display text-xl font-bold text-[#d9ecff]">Đồng bộ dữ liệu</h2>
          <p className="mb-6 text-sm text-[#b0b0d1]">
            Dùng sync key để backup và đồng bộ dữ liệu giữa các thiết bị. Không cần đăng nhập.
          </p>
          <div className="space-y-6 rounded-xl border border-white/10 p-6">
            <div>
              <p className="mb-2 text-sm font-medium text-[#d9ecff]">Sync Key của thiết bị này</p>
              <div className="flex items-center gap-3">
                <code className="flex-1 rounded-lg bg-white/5 px-3 py-2 font-mono text-sm text-[#b0b0d1] overflow-hidden">
                  {syncKey ? `${syncKey.slice(0, 8)}••••••••••••••••••••••••••••` : "Đang tải..."}
                </code>
                <button
                  onClick={handleCopy}
                  className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-[#d9ecff] hover:bg-white/20"
                >
                  {copied ? "Đã copy!" : "Copy full key"}
                </button>
              </div>
              <p className="mt-1 text-xs text-[#b0b0d1]">{formatSynced(lastSynced)}</p>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-[#d9ecff]">Lấy dữ liệu từ thiết bị khác</p>
              <p className="mb-3 text-xs text-[#b0b0d1]">
                Nhập sync key của thiết bị khác để thêm từ vựng của thiết bị đó vào đây.
                Dữ liệu hiện tại trên thiết bị này sẽ không bị mất.
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={pullInput}
                  onChange={(e) => setPullInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handlePull(); }}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx hoặc ThankZ"
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white placeholder-[#b0b0d1] focus:border-white/30 focus:outline-none"
                />
                <button
                  onClick={() => void handlePull()}
                  disabled={pulling || !pullInput.trim()}
                  className="shrink-0 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-[#d9ecff] hover:bg-white/20 disabled:opacity-50"
                >
                  {pulling ? "Đang lấy..." : "Pull data"}
                </button>
              </div>
              {pullSuccess && <p className="mt-2 text-sm font-medium text-green-400">{pullSuccess}</p>}
              {pullError && <p className="mt-2 text-sm font-medium text-red-400">{pullError}</p>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: All PASS. If any fail, check that mock for `useVoiceSettings` is present in all affected test files.

- [ ] **Step 3: Start dev server and verify in browser**

```bash
npm run dev
```

Open `http://localhost:3000/settings`. Verify:
- Three tabs render: "AI Providers", "Voice", "Sync"
- Clicking each tab shows the correct content
- Voice tab: dropdown lists English voices, sliders render with correct default values (Rate 0.9, Pitch 1.0, Volume 1.0)
- "Thử nghe" button plays speech
- Moving a slider updates the displayed value
- "Reset về mặc định" restores all sliders to defaults
- Navigating to `/` and clicking 🔊 on a flashcard uses the saved voice settings

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: refactor settings page with Providers/Voice/Sync tab navigation"
```
