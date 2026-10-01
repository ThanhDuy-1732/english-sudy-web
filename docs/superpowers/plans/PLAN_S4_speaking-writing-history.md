# S4 — Speaking/Writing History + Band Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist speaking and writing sessions to dedicated localStorage stores (and Supabase), then surface band progress via a BandTimelineChart and 4-skill SkillRadar on the Stats page.

**Architecture:** Two new storage modules (`speaking-storage.ts`, `writing-storage.ts`) following the existing fire-and-forget sync pattern. Two Supabase tables. Two new chart components added to `/stats`. `lastSpeakingAt`/`lastWritingAt` become derived values read from the stores.

**Tech Stack:** TypeScript, Recharts (already installed), Supabase, Jest

**Spec:** `docs/requirement/PLAN_PHASE_6_7_COMPLETION.md` — section S4

**Depends on:** PLAN_S1_sync-lww.md (needs updated `initSync` pattern)

## Global Constraints

- Next.js 14 App Router, TypeScript strict
- `localStorage` primary; max 200 speaking records, max 100 writing records
- `pronunciation` band is always `null` — never display a number for it
- `overall` band is a float 0–9
- `npm test && npm run lint && npm run build` must pass after every commit

---

### Task 1: Supabase migration — speaking_sessions, writing_submissions

**Files:**
- Create: `supabase/migrations/20260921_speaking_writing.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- supabase/migrations/20260921_speaking_writing.sql

create table if not exists speaking_sessions (
  id          text primary key,
  sync_key    uuid not null,
  mode        text not null,
  payload     jsonb not null,
  overall     numeric,
  created_at  timestamptz not null,
  updated_at  timestamptz not null default now()
);
create index if not exists speaking_user
  on speaking_sessions (sync_key, created_at desc);

create table if not exists writing_submissions (
  id          text primary key,
  sync_key    uuid not null,
  kind        text not null,
  payload     jsonb not null,
  overall     numeric,
  created_at  timestamptz not null,
  updated_at  timestamptz not null default now()
);
create index if not exists writing_user
  on writing_submissions (sync_key, created_at desc);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260921_speaking_writing.sql
git commit -m "feat(sync): add speaking_sessions and writing_submissions tables"
```

---

### Task 2: `speaking-storage.ts` — persist speaking records

**Files:**
- Create: `src/lib/speech/speaking-storage.ts`
- Create: `src/lib/speech/__tests__/speaking-storage.test.ts`

**Interfaces:**
- Consumes: `SpeakingFeedback` from `src/lib/speech/types.ts`; `getSyncKey`, `createSupabase` from sync/supabase
- Produces:
  - `SpeakingRecord` interface (exported)
  - `saveSpeaking(r: SpeakingRecord): void`
  - `getSpeaking(): SpeakingRecord[]`
  - `pushSpeaking(r: SpeakingRecord): void`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/speech/__tests__/speaking-storage.test.ts
import { saveSpeaking, getSpeaking } from '../speaking-storage';
import type { SpeakingRecord } from '../speaking-storage';

const make = (id: string, createdAt: string): SpeakingRecord => ({
  id,
  mode: 'ielts_p1',
  prompt: 'Describe your home',
  transcript: 'I live in a house',
  durationSec: 60,
  feedback: {
    transcript: 'I live in a house',
    durationSec: 60,
    wordsPerMinute: 90,
    fillerCount: 0,
    bands: { fluency: 6, lexical: 6, grammar: 6, pronunciation: null },
    overall: 6,
    strengths: [],
    improvements: [],
    upgradedVersion: '',
    newVocabulary: [],
  },
  createdAt,
});

beforeEach(() => localStorage.clear());

it('saveSpeaking stores newest first', () => {
  saveSpeaking(make('a', '2026-01-01T00:00:00.000Z'));
  saveSpeaking(make('b', '2026-01-02T00:00:00.000Z'));
  const all = getSpeaking();
  expect(all[0].id).toBe('b');
  expect(all[1].id).toBe('a');
});

it('saveSpeaking deduplicates by id', () => {
  saveSpeaking(make('a', '2026-01-01T00:00:00.000Z'));
  saveSpeaking(make('a', '2026-01-01T00:00:00.000Z'));
  expect(getSpeaking()).toHaveLength(1);
});

it('saveSpeaking caps at 200 records', () => {
  for (let i = 0; i < 205; i++) {
    saveSpeaking(make(`r${i}`, new Date(Date.UTC(2026, 0, i + 1)).toISOString()));
  }
  expect(getSpeaking().length).toBeLessThanOrEqual(200);
});

it('saveSpeaking updates lastSpeakingAt', () => {
  saveSpeaking(make('x', '2026-06-01T00:00:00.000Z'));
  expect(localStorage.getItem('lastSpeakingAt')).toBe('2026-06-01T00:00:00.000Z');
});

it('getSpeaking returns empty array when storage empty', () => {
  expect(getSpeaking()).toEqual([]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=speaking-storage
```

- [ ] **Step 3: Implement `speaking-storage.ts`**

```ts
// src/lib/speech/speaking-storage.ts
import type { SpeakingFeedback } from './types';
import { createSupabase } from '@/lib/supabase';
import { getSyncKey } from '@/lib/sync';

export interface SpeakingRecord {
  id: string;
  mode: 'ielts_p1' | 'ielts_p2' | 'ielts_p3' | 'roleplay' | 'shadowing';
  prompt: string;
  transcript: string;
  durationSec: number;
  feedback: SpeakingFeedback;
  audioId?: string;
  createdAt: string;
  updatedAt?: string;
}

const KEY = 'speakingSessions';
const MAX = 200;

export function getSpeaking(): SpeakingRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SpeakingRecord[]) : [];
  } catch { return []; }
}

export function saveSpeaking(r: SpeakingRecord): void {
  if (typeof window === 'undefined') return;
  const updated: SpeakingRecord = { ...r, updatedAt: new Date().toISOString() };
  const all = getSpeaking().filter(x => x.id !== r.id);
  all.unshift(updated);
  localStorage.setItem(KEY, JSON.stringify(all.slice(0, MAX)));
  localStorage.setItem('lastSpeakingAt', r.createdAt);
  pushSpeaking(updated);
}

export function pushSpeaking(r: SpeakingRecord): void {
  if (typeof window === 'undefined') return;
  const syncKey = getSyncKey();
  const supabase = createSupabase(syncKey);
  void supabase.from('speaking_sessions').upsert({
    id: r.id,
    sync_key: syncKey,
    mode: r.mode,
    payload: r,
    overall: r.feedback.overall,
    created_at: r.createdAt,
    updated_at: r.updatedAt ?? r.createdAt,
  }, { onConflict: 'id' });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=speaking-storage
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/speech/speaking-storage.ts src/lib/speech/__tests__/speaking-storage.test.ts
git commit -m "feat(speak): SpeakingRecord storage + Supabase push"
```

---

### Task 3: `writing-storage.ts` — persist writing submissions

**Files:**
- Create: `src/lib/write/writing-storage.ts`
- Create: `src/lib/write/__tests__/writing-storage.test.ts`

**Interfaces:**
- Produces:
  - `WritingRecord` interface (exported)
  - `saveWriting(r: WritingRecord): void`
  - `getWriting(): WritingRecord[]`
  - `pushWriting(r: WritingRecord): void`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/write/__tests__/writing-storage.test.ts
import { saveWriting, getWriting } from '../writing-storage';
import type { WritingRecord } from '../writing-storage';

const makeFeedback = () => ({
  bands: { task: 6, coherence: 6, lexical: 6, grammar: 6 },
  overall: 6,
  wordCount: 250,
  annotations: [],
  modelAnswer: 'Model answer here.',
  nextFocus: 'Task response',
});

const make = (id: string, createdAt: string): WritingRecord => ({
  id,
  kind: 'ielts_task2' as const,
  prompt: 'Discuss both views',
  content: 'In this essay...',
  wordCount: 250,
  feedback: makeFeedback(),
  createdAt,
});

beforeEach(() => localStorage.clear());

it('saveWriting stores newest first', () => {
  saveWriting(make('a', '2026-01-01T00:00:00.000Z'));
  saveWriting(make('b', '2026-01-02T00:00:00.000Z'));
  expect(getWriting()[0].id).toBe('b');
});

it('saveWriting deduplicates by id', () => {
  saveWriting(make('a', '2026-01-01T00:00:00.000Z'));
  saveWriting(make('a', '2026-01-01T00:00:00.000Z'));
  expect(getWriting()).toHaveLength(1);
});

it('saveWriting updates lastWritingAt', () => {
  saveWriting(make('x', '2026-06-01T00:00:00.000Z'));
  expect(localStorage.getItem('lastWritingAt')).toBe('2026-06-01T00:00:00.000Z');
});

it('getWriting returns empty array when empty', () => {
  expect(getWriting()).toEqual([]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=writing-storage
```

- [ ] **Step 3: Implement `writing-storage.ts`**

```ts
// src/lib/write/writing-storage.ts
import { createSupabase } from '@/lib/supabase';
import { getSyncKey } from '@/lib/sync';

export type WritingKind = 'ielts_task1' | 'ielts_task2' | 'toeic_email';

export interface WritingFeedbackShape {
  bands: { task: number; coherence: number; lexical: number; grammar: number };
  overall: number;
  wordCount: number;
  annotations: { excerpt: string; issue: string; category: string; suggestion: string }[];
  modelAnswer: string;
  nextFocus: string;
}

export interface WritingRecord {
  id: string;
  kind: WritingKind;
  prompt: string;
  chartData?: unknown;
  content: string;
  wordCount: number;
  feedback: WritingFeedbackShape;
  createdAt: string;
  updatedAt?: string;
}

const KEY = 'writingSubmissions';
const MAX = 100;

export function getWriting(): WritingRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WritingRecord[]) : [];
  } catch { return []; }
}

export function saveWriting(r: WritingRecord): void {
  if (typeof window === 'undefined') return;
  const updated: WritingRecord = { ...r, updatedAt: new Date().toISOString() };
  const all = getWriting().filter(x => x.id !== r.id);
  all.unshift(updated);
  localStorage.setItem(KEY, JSON.stringify(all.slice(0, MAX)));
  localStorage.setItem('lastWritingAt', r.createdAt);
  pushWriting(updated);
}

export function pushWriting(r: WritingRecord): void {
  if (typeof window === 'undefined') return;
  const syncKey = getSyncKey();
  const supabase = createSupabase(syncKey);
  void supabase.from('writing_submissions').upsert({
    id: r.id,
    sync_key: syncKey,
    kind: r.kind,
    payload: r,
    overall: r.feedback.overall,
    created_at: r.createdAt,
    updated_at: r.updatedAt ?? r.createdAt,
  }, { onConflict: 'id' });
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern=writing-storage
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/write/ 
git commit -m "feat(write): WritingRecord storage + Supabase push"
```

---

### Task 4: Wire `saveSpeaking`/`saveWriting` into pages

**Files:**
- Modify: `src/app/speak/ielts/[part]/page.tsx`
- Modify: `src/app/speak/roleplay/[id]/page.tsx`
- Modify: `src/app/write/task/[id]/page.tsx`

**Interfaces:**
- Consumes: `saveSpeaking` from `src/lib/speech/speaking-storage`, `saveWriting` from `src/lib/write/writing-storage`

- [ ] **Step 1: Wire into IELTS speaking page**

In `src/app/speak/ielts/[part]/page.tsx`, find where grading result is handled (after `/api/speech/grade` returns). Import and call:

```ts
import { saveSpeaking } from '@/lib/speech/speaking-storage';
import type { SpeakingRecord } from '@/lib/speech/speaking-storage';

// After successful grade response, before setting UI state:
const record: SpeakingRecord = {
  id: crypto.randomUUID(),
  mode: `ielts_${part}` as SpeakingRecord['mode'],
  prompt: task.prompt,
  transcript: feedback.transcript,
  durationSec: feedback.durationSec,
  feedback,
  createdAt: new Date().toISOString(),
};
saveSpeaking(record);
```

- [ ] **Step 2: Wire into roleplay page**

In `src/app/speak/roleplay/[id]/page.tsx`, find where the session ends (user completes the conversation). Call:

```ts
import { saveSpeaking } from '@/lib/speech/speaking-storage';

// On session end (last turn completed):
saveSpeaking({
  id: crypto.randomUUID(),
  mode: 'roleplay',
  prompt: scenario.goal,
  transcript: history.map(t => `${t.role}: ${t.text}`).join('\n'),
  durationSec: Math.round(sessionDurationMs / 1000),
  feedback: {
    transcript: '',
    durationSec: Math.round(sessionDurationMs / 1000),
    wordsPerMinute: 0,
    fillerCount: 0,
    bands: { fluency: 0, lexical: 0, grammar: 0, pronunciation: null },
    overall: 0,
    strengths: [],
    improvements: [],
    upgradedVersion: '',
    newVocabulary: [],
  },
  createdAt: new Date().toISOString(),
});
```

Note: roleplay does not grade bands — overall=0 is acceptable for history tracking. The page already has session logic; adapt variable names to match actual page code.

- [ ] **Step 3: Wire into writing task page**

In `src/app/write/task/[id]/page.tsx`, find where grade result is saved (after `/api/write/grade` returns). Import and call:

```ts
import { saveWriting } from '@/lib/write/writing-storage';

// After successful grade response (feedback is the parsed WritingFeedback):
saveWriting({
  id: resultId,  // the same id used for /write/result/[id]
  kind: task.kind as WritingKind,
  prompt: task.prompt,
  chartData: task.chartData,
  content: essayContent,
  wordCount: feedback.wordCount,
  feedback,
  createdAt: new Date().toISOString(),
});
```

- [ ] **Step 4: Run lint and build**

```bash
npm run lint && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/app/speak/ src/app/write/
git commit -m "feat(speak,write): wire saveSpeaking/saveWriting into pages"
```

---

### Task 5: `stats-skills.ts` + `BandTimelineChart` + `SkillRadar`

**Files:**
- Create: `src/lib/stats-skills.ts`
- Create: `src/components/charts/BandTimelineChart.tsx`
- Create: `src/components/charts/SkillRadar.tsx`
- Create: `src/lib/__tests__/stats-skills.test.ts`

**Interfaces:**
- Consumes: `getSpeaking` from `src/lib/speech/speaking-storage`, `getWriting` from `src/lib/write/writing-storage`, `getAttempts` from `src/lib/exam/exam-storage`
- Produces:
  - `weeklyBands(weeks?: number): WeeklyBand[]`
  - `skillRadar(): SkillRadarPoint[]`
  - `WeeklyBand`, `SkillRadarPoint` interfaces (exported)

- [ ] **Step 1: Write failing tests for stats-skills**

```ts
// src/lib/__tests__/stats-skills.test.ts
import { weeklyBands, skillRadar } from '../stats-skills';

beforeEach(() => localStorage.clear());

it('weeklyBands returns empty array when no data', () => {
  expect(weeklyBands()).toEqual([]);
});

it('weeklyBands groups records by ISO week', () => {
  const { saveSpeaking } = require('../speech/speaking-storage');
  saveSpeaking({
    id: 'a', mode: 'ielts_p2', prompt: 'p', transcript: 't', durationSec: 60,
    feedback: { transcript: '', durationSec: 60, wordsPerMinute: 80, fillerCount: 0,
      bands: { fluency: 7, lexical: 6, grammar: 7, pronunciation: null },
      overall: 6.5, strengths: [], improvements: [], upgradedVersion: '', newVocabulary: [] },
    createdAt: '2026-09-15T00:00:00.000Z',
  });
  const result = weeklyBands(12);
  expect(result.length).toBeGreaterThan(0);
  const week = result.find(w => w.week === '2026-W38');
  expect(week?.speaking).toBeCloseTo(6.5, 1);
});

it('skillRadar returns null for skills with no data', () => {
  const radar = skillRadar();
  for (const p of radar) {
    if (p.samples === 0) expect(p.value).toBeNull();
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=stats-skills
```

- [ ] **Step 3: Implement `stats-skills.ts`**

```ts
// src/lib/stats-skills.ts
import { getSpeaking } from './speech/speaking-storage';
import { getWriting } from './write/writing-storage';
import { getAttempts } from './exam/exam-storage';

export interface WeeklyBand {
  week: string;           // ISO week key e.g. "2026-W38"
  speaking?: number;
  writing?: number;
  listening?: number;
  reading?: number;
}

export interface SkillRadarPoint {
  skill: 'L' | 'R' | 'S' | 'W';
  label: string;
  value: number | null;  // 0–100, null when no data
  samples: number;
}

function isoWeek(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = Math.ceil(((d.getTime() - jan4.getTime()) / 86400000 + (jan4.getUTCDay() || 7)) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function avg(nums: number[]): number | undefined {
  if (!nums.length) return undefined;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function weeklyBands(weeks = 12): WeeklyBand[] {
  const cutoff = new Date(Date.now() - weeks * 7 * 86400000).toISOString();
  const map = new Map<string, { s: number[]; w: number[]; l: number[]; r: number[] }>();
  const ensure = (k: string) => {
    if (!map.has(k)) map.set(k, { s: [], w: [], l: [], r: [] });
    return map.get(k)!;
  };

  for (const s of getSpeaking()) {
    if (s.createdAt < cutoff) continue;
    ensure(isoWeek(s.createdAt)).s.push(s.feedback.overall);
  }
  for (const w of getWriting()) {
    if (w.createdAt < cutoff) continue;
    ensure(isoWeek(w.createdAt)).w.push(w.feedback.overall);
  }

  const LC_PARTS = new Set(['LC1', 'LC2', 'LC3', 'LC4', 'LISTEN_S1', 'LISTEN_S2', 'LISTEN_S3', 'LISTEN_S4']);
  const RC_PARTS = new Set(['RC5', 'RC6', 'RC7', 'READ_P1', 'READ_P2', 'READ_P3']);
  for (const a of getAttempts()) {
    if (!a.finishedAt || a.finishedAt < cutoff || !a.score?.ielts) continue;
    const wk = isoWeek(a.finishedAt);
    const isLC = a.parts.some((p: string) => LC_PARTS.has(p));
    const isRC = a.parts.some((p: string) => RC_PARTS.has(p));
    if (a.score.ielts.listening != null && isLC) ensure(wk).l.push(a.score.ielts.listening);
    if (a.score.ielts.reading != null && isRC) ensure(wk).r.push(a.score.ielts.reading);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, d]) => ({
      week,
      ...(d.s.length ? { speaking: avg(d.s) } : {}),
      ...(d.w.length ? { writing: avg(d.w) } : {}),
      ...(d.l.length ? { listening: avg(d.l) } : {}),
      ...(d.r.length ? { reading: avg(d.r) } : {}),
    }));
}

export function skillRadar(): SkillRadarPoint[] {
  const speaking = getSpeaking().slice(0, 5);
  const writing = getWriting().slice(0, 5);
  const attempts = getAttempts().slice(0, 20);

  const LC_PARTS = new Set(['LC1', 'LC2', 'LC3', 'LC4', 'LISTEN_S1', 'LISTEN_S2', 'LISTEN_S3', 'LISTEN_S4']);
  const RC_PARTS = new Set(['RC5', 'RC6', 'RC7', 'READ_P1', 'READ_P2', 'READ_P3']);

  const lAnswers = attempts.flatMap(a =>
    a.answers.filter((x: { part: string; correct: boolean }) => LC_PARTS.has(x.part)));
  const rAnswers = attempts.flatMap(a =>
    a.answers.filter((x: { part: string; correct: boolean }) => RC_PARTS.has(x.part)));

  const lAcc = lAnswers.length ? lAnswers.filter((x: { correct: boolean }) => x.correct).length / lAnswers.length * 100 : null;
  const rAcc = rAnswers.length ? rAnswers.filter((x: { correct: boolean }) => x.correct).length / rAnswers.length * 100 : null;
  const sAvg = speaking.length ? avg(speaking.map(s => s.feedback.overall))! / 9 * 100 : null;
  const wAvg = writing.length ? avg(writing.map(w => w.feedback.overall))! / 9 * 100 : null;

  return [
    { skill: 'L', label: 'Listening', value: lAnswers.length ? lAcc : null, samples: lAnswers.length },
    { skill: 'R', label: 'Reading',   value: rAnswers.length ? rAcc : null, samples: rAnswers.length },
    { skill: 'S', label: 'Speaking',  value: speaking.length ? sAvg : null, samples: speaking.length },
    { skill: 'W', label: 'Writing',   value: writing.length  ? wAvg : null, samples: writing.length  },
  ];
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern=stats-skills
```

- [ ] **Step 5: Commit lib**

```bash
git add src/lib/stats-skills.ts src/lib/__tests__/stats-skills.test.ts
git commit -m "feat(stats): weeklyBands + skillRadar calculations"
```

- [ ] **Step 6: Create `BandTimelineChart.tsx`**

```tsx
// src/components/charts/BandTimelineChart.tsx
"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { WeeklyBand } from "@/lib/stats-skills";

const COLORS = { speaking: "#7c3aed", writing: "#2563eb", listening: "#059669", reading: "#d97706" };

export default function BandTimelineChart({ data }: { data: WeeklyBand[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-500 py-4 text-center">Chưa có dữ liệu band.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="week" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 9]} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: number) => v.toFixed(1)} />
        <Legend />
        {(["speaking","writing","listening","reading"] as const).map(k => (
          <Line key={k} type="monotone" dataKey={k} stroke={COLORS[k]}
            dot={false} strokeWidth={2} connectNulls={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 7: Create `SkillRadar.tsx`**

```tsx
// src/components/charts/SkillRadar.tsx
"use client";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";
import type { SkillRadarPoint } from "@/lib/stats-skills";

export default function SkillRadar({ data }: { data: SkillRadarPoint[] }) {
  const hasData = data.some(d => d.value !== null);
  if (!hasData) {
    return <p className="text-sm text-gray-500 py-4 text-center">Chưa có đủ dữ liệu 4 kỹ năng.</p>;
  }
  const chartData = data.map(d => ({ label: d.label, value: d.value ?? 0, hasData: d.value !== null }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <RadarChart data={chartData}>
        <PolarGrid />
        <PolarAngleAxis dataKey="label" tick={{ fontSize: 12 }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
        <Radar name="Skill" dataKey="value" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.3} />
        <Tooltip formatter={(v: number) => `${v.toFixed(0)}%`} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 8: Add charts to `/stats` page**

In `src/app/stats/page.tsx`, import and render the two new charts:

```ts
import BandTimelineChart from "@/components/charts/BandTimelineChart";
import SkillRadar from "@/components/charts/SkillRadar";
import { weeklyBands, skillRadar } from "@/lib/stats-skills";
```

Add them above `ExamAccuracyChart` (they are client-side, so wrap in a client component or use `"use client"` at page level if not already):

```tsx
<section>
  <h2 className="text-lg font-semibold mb-3">Band theo tuần (12 tuần gần nhất)</h2>
  <BandTimelineChart data={weeklyBands(12)} />
</section>
<section>
  <h2 className="text-lg font-semibold mb-3">4 kỹ năng</h2>
  <SkillRadar data={skillRadar()} />
</section>
```

- [ ] **Step 9: Run full build**

```bash
npm test && npm run lint && npm run build
```

- [ ] **Step 10: Commit**

```bash
git add src/components/charts/BandTimelineChart.tsx src/components/charts/SkillRadar.tsx src/app/stats/
git commit -m "feat(stats): band timeline + 4-skill radar charts"
```

---

### Task 6: Verify with check script

- [ ] **Step 1: Run S0 for S4**

```bash
./scripts/check-phase-6-7.sh 2>&1 | grep -A4 "S4"
```

Expected: all three S4 checks ✅
