# S7 (remaining) — IndexedDB Audio Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the last 20 speaking recordings to IndexedDB so users can replay their audio in the result screen.

**Architecture:** A thin `audio-store.ts` module wraps `idb-keyval` (to install). After a successful IELTS speaking session, the raw `Blob` is stored. The result/feedback screen loads the blob and renders an `<audio>` element. Settings tab gets a "clear recordings" button.

**Tech Stack:** TypeScript, `idb-keyval` (new dependency), Jest (mock IndexedDB)

**Spec:** `docs/requirement/PLAN_PHASE_6_7_COMPLETION.md` — section S7.1

**Depends on:** PLAN_S4_speaking-writing-history.md (SpeakingRecord has `audioId` field)

## Global Constraints

- Audio NOT synced to Supabase — local only
- Max 20 recordings; LRU eviction
- Revoke `URL.createObjectURL` on component unmount
- `npm test && npm run lint && npm run build` must pass after every commit

---

### Task 1: Install `idb-keyval` and create `audio-store.ts`

**Files:**
- Create: `src/lib/speech/audio-store.ts`
- Create: `src/lib/speech/__tests__/audio-store.test.ts`

**Interfaces:**
- Produces:
  - `saveAudio(id: string, blob: Blob): Promise<void>`
  - `loadAudio(id: string): Promise<Blob | undefined>`
  - `clearAllAudio(): Promise<void>`
  - `getAudioCount(): Promise<number>`

- [ ] **Step 1: Install idb-keyval**

```bash
npm install idb-keyval
```

- [ ] **Step 2: Write failing tests**

```ts
// src/lib/speech/__tests__/audio-store.test.ts
// idb-keyval needs fake IndexedDB. Use jest mock.
jest.mock('idb-keyval', () => {
  const store = new Map<string, unknown>();
  return {
    get: jest.fn((key: string) => Promise.resolve(store.get(key))),
    set: jest.fn((key: string, val: unknown) => { store.set(key, val); return Promise.resolve(); }),
    del: jest.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  };
});

import { saveAudio, loadAudio, clearAllAudio, getAudioCount } from '../audio-store';

it('saveAudio and loadAudio round-trip', async () => {
  const blob = new Blob(['audio data'], { type: 'audio/webm' });
  await saveAudio('rec1', blob);
  const loaded = await loadAudio('rec1');
  expect(loaded).toBe(blob);
});

it('saveAudio caps at 20 recordings', async () => {
  for (let i = 0; i < 25; i++) {
    await saveAudio(`r${i}`, new Blob([`data${i}`]));
  }
  const count = await getAudioCount();
  expect(count).toBeLessThanOrEqual(20);
});

it('loadAudio returns undefined for missing key', async () => {
  const result = await loadAudio('nonexistent-key');
  expect(result).toBeUndefined();
});

it('clearAllAudio removes all recordings', async () => {
  await saveAudio('x', new Blob(['x']));
  await clearAllAudio();
  expect(await getAudioCount()).toBe(0);
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=audio-store
```

- [ ] **Step 4: Implement `audio-store.ts`**

```ts
// src/lib/speech/audio-store.ts
import { get, set, del } from 'idb-keyval';

const INDEX_KEY = '__audioIndex';
const MAX = 20;

async function getIndex(): Promise<string[]> {
  return (await get<string[]>(INDEX_KEY)) ?? [];
}

export async function saveAudio(id: string, blob: Blob): Promise<void> {
  await set(`audio:${id}`, blob);
  const index = await getIndex();
  const next = [id, ...index.filter(x => x !== id)];
  // Evict oldest beyond MAX
  for (const old of next.slice(MAX)) await del(`audio:${old}`);
  await set(INDEX_KEY, next.slice(0, MAX));
}

export function loadAudio(id: string): Promise<Blob | undefined> {
  return get<Blob>(`audio:${id}`);
}

export async function clearAllAudio(): Promise<void> {
  const index = await getIndex();
  await Promise.all(index.map(id => del(`audio:${id}`)));
  await set(INDEX_KEY, []);
}

export async function getAudioCount(): Promise<number> {
  return (await getIndex()).length;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=audio-store
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/speech/audio-store.ts src/lib/speech/__tests__/audio-store.test.ts package.json package-lock.json
git commit -m "feat(speak): IndexedDB audio store (idb-keyval, max 20)"
```

---

### Task 2: Save audio after recording in IELTS speaking page

**Files:**
- Modify: `src/app/speak/ielts/[part]/page.tsx`
- Modify: `src/lib/speech/speaking-storage.ts` (add `audioId` to `SpeakingRecord`)

**Interfaces:**
- Consumes: `saveAudio` from `src/lib/speech/audio-store`, `saveSpeaking` (already called from Task 4 of PLAN_S4)
- Produces: `SpeakingRecord.audioId` set to the recording id when audio is saved

- [ ] **Step 1: Verify `SpeakingRecord` already has `audioId?: string`**

```bash
grep -n "audioId" src/lib/speech/speaking-storage.ts
```

If present, proceed. If missing, add `audioId?: string` to the `SpeakingRecord` interface.

- [ ] **Step 2: Save audio blob in IELTS page after recording**

In `src/app/speak/ielts/[part]/page.tsx`, find where recording stops and `gradeRef.current` blob is available. Add:

```ts
import { saveAudio } from '@/lib/speech/audio-store';

// After recorder.stop() and before calling /api/speech/transcribe:
const audioId = crypto.randomUUID();
await saveAudio(audioId, audioBlob);
// Store audioId in state to pass to saveSpeaking later:
setCurrentAudioId(audioId);
```

Then when calling `saveSpeaking`, include `audioId`:

```ts
saveSpeaking({
  ...record,
  audioId: currentAudioId ?? undefined,
});
```

Adapt variable names to match actual page code (check with `grep -n "audioBlob\|recorder\|blob" src/app/speak/ielts/\[part\]/page.tsx`).

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add src/app/speak/ielts/ src/lib/speech/speaking-storage.ts
git commit -m "feat(speak): save audio blob to IndexedDB after recording"
```

---

### Task 3: Replay audio in speaking result/feedback UI

**Files:**
- Modify: `src/app/speak/ielts/[part]/page.tsx` (the feedback/result section of the page)

**Interfaces:**
- Consumes: `loadAudio` from `src/lib/speech/audio-store`

- [ ] **Step 1: Add audio replay section to feedback UI**

Find the feedback display section in the IELTS speaking page (after grade result is shown). Add a replay section:

```tsx
import { useEffect, useRef, useState } from 'react';
import { loadAudio } from '@/lib/speech/audio-store';

// Inside the component, add state:
const [audioUrl, setAudioUrl] = useState<string | null>(null);
const audioUrlRef = useRef<string | null>(null);

// Load audio when audioId is available:
useEffect(() => {
  if (!currentAudioId) return;
  loadAudio(currentAudioId).then(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    audioUrlRef.current = url;
    setAudioUrl(url);
  });
  return () => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  };
}, [currentAudioId]);

// In the JSX feedback section:
{audioUrl && (
  <div className="mt-4">
    <p className="text-sm font-medium mb-1">Nghe lại</p>
    <audio controls src={audioUrl} className="w-full" />
  </div>
)}
```

- [ ] **Step 2: Run lint and build**

```bash
npm run lint && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/speak/ielts/
git commit -m "feat(speak): audio replay UI in IELTS feedback screen"
```

---

### Task 4: Clear recordings button in Settings

**Files:**
- Modify: `src/app/settings/page.tsx`

**Interfaces:**
- Consumes: `clearAllAudio`, `getAudioCount` from `src/lib/speech/audio-store`

- [ ] **Step 1: Add clear button in Voice tab**

In `src/app/settings/page.tsx`, find the Voice tab section. Add:

```tsx
import { clearAllAudio, getAudioCount } from '@/lib/speech/audio-store';

// Add state:
const [audioCount, setAudioCount] = useState(0);

// Load count on mount:
useEffect(() => {
  getAudioCount().then(setAudioCount);
}, []);

// In Voice tab JSX:
<div className="mt-4">
  <button
    onClick={async () => {
      await clearAllAudio();
      setAudioCount(0);
    }}
    className="text-sm text-red-400 underline"
  >
    Xoá bản ghi âm ({audioCount})
  </button>
</div>
```

- [ ] **Step 2: Run lint and build**

```bash
npm run lint && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/settings/
git commit -m "feat(settings): clear audio recordings button"
```

---

### Task 5: Verify with check script

- [ ] **Step 1: Run S0 for S7**

```bash
./scripts/check-phase-6-7.sh 2>&1 | grep -A3 "S7"
```

Expected: "IndexedDB cho audio" ✅ (shadowing was already ✅)
