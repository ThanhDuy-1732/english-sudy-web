# CONTEXT.md — English Study App

Quick reference for Claude. Do not repeat what's already in CLAUDE.md.

---

## Tech Stack

Next.js 14 App Router · TypeScript · Tailwind CSS · Jest (jsdom) · Supabase (no auth) · Firebase (hosting only) · PWA (service worker in `public/sw.js`)

---

## Pages & Routes

| Route | File | Purpose |
|---|---|---|
| `/` | `src/app/page.tsx` | Generate & study flashcards |
| `/history` | `src/app/history/page.tsx` | Browse saved words, filter by topic/mastery |
| `/review` | `src/app/review/page.tsx` | Spaced-repetition review of due words |
| `/stats` | `src/app/stats/page.tsx` | Learning analytics — 4 stat tiles (words, active days, mastery, today's study minutes), words-per-day chart, study-time chart, topic distribution, streak calendar |
| `/import` | `src/app/import/page.tsx` | Bulk import words |
| `/settings` | `src/app/settings/page.tsx` | 3 tabs: AI Providers · Voice · Sync |

---

## API Routes (all POST)

| Route | Body | Response |
|---|---|---|
| `/api/generate-words` | `{ topic, provider?, disabledProviders? }` | `{ word, meaning }[]` |
| `/api/generate-sentence` | `{ word, provider?, disabledProviders? }` | `{ sentence }` |
| `/api/generate-synonyms` | `{ word, provider?, disabledProviders? }` | `{ synonyms: string[], antonyms: string[] }` |
| `/api/generate-batch` | `{ words, provider?, disabledProviders? }` | batch sentences+synonyms |
| `/api/generate-fillblank` | `{ word, provider?, disabledProviders? }` | `{ sentence }` (with blank) |
| `/api/generate-reading` | `{ words, provider?, disabledProviders? }` | `{ passage, questions[] }` |
| `/api/grade-sentence` | `{ word, sentence, provider?, disabledProviders? }` | grading result |
| `/api/providers` | GET | `{ id, name, model }[]` of configured providers |
| `/api/providers/test` | `{ providerId }` | `{ ok, latency, error? }` |

All AI-calling routes pass `provider` + `disabledProviders` to `callWithFallback`. They set header `X-Provider-Used` in the response. Actual AI calls live in `src/lib/providers/`.

---

## Data Models

### LearnedWord (`src/lib/storage.ts`)
```ts
interface LearnedWord {
  word: string;
  meaning: string;
  example: string;
  topic: string;
  learnedAt: string;           // ISO
  nextReviewAt?: string;       // ISO, defaults to +1 day
  reviewInterval?: number;     // days, starts 1, doubles up to 30 on "remembered"
  mastery?: number;            // 0–5 stars
  synonyms?: string[];
  antonyms?: string[];
}
```

### DailyChallenge (`src/lib/daily-challenge.ts`)
```ts
interface DailyChallenge {
  date: string;   // YYYY-MM-DD
  words: string[];
  completed: boolean;
}
```

### VoiceSettings (`src/lib/voiceSettings.ts`)
```ts
interface VoiceSettings {
  voiceURI: string | null;
  rate: number;    // default 0.9
  pitch: number;   // default 1.0
  volume: number;  // default 1.0
}
```

---

## localStorage Keys

| Key | Type | Purpose |
|---|---|---|
| `learnedWords` | `LearnedWord[]` | All saved words |
| `dailyChallenge` | `DailyChallenge[]` | Full history |
| `customTopics` | `string[]` | User-added topics |
| `studyTime` | `Record<string, number>` | Daily study seconds — `{ "YYYY-MM-DD": seconds }` |
| `voiceSettings` | `VoiceSettings` | TTS settings |
| `syncKey` | `string` (UUID) | Supabase identity (auto-generated) |
| `lastSyncedAt` | ISO string | Timestamp of last Supabase sync |
| `preferredProvider` | `string` | Provider id (e.g. `"gemini"`) |
| `disabledProviders` | `string[]` | Opt-out provider ids |

---

## AI Provider System (`src/lib/providers/`)

**Types**: `src/lib/providers/types.ts` — `AIProvider` interface (`id`, `name`, `model`, `generateContent`)

**Implementations**:
- `gemini.ts` — Google Gemini (via `@google/generative-ai`)
- `openai-compat.ts` — OpenAI-compatible (Groq, OpenRouter, Mistral, Cohere, HuggingFace)

**Registry** (`src/lib/providers/index.ts`):
- Built from env vars at module load time
- `callWithFallback(prompt, preferredId?, disabledIds?)` — tries preferred first, falls back on 429/503
- `getRegisteredProviders()` — returns all configured providers
- Active providers: whichever env keys are set in `.env.local`

**Supported providers** (env key → default model):
- `GEMINI_API_KEY` → `gemini-flash-latest`
- `GROQ_API_KEY` → `llama-3.3-70b-versatile`
- `OPENROUTER_API_KEY` → `nvidia/nemotron-3-nano-30b-a3b:free`
- `MISTRAL_API_KEY` → `mistral-small-latest`
- `COHERE_API_KEY` → `command-r7b-12-2024`
- `HUGGINGFACE_API_KEY` → `meta-llama/Llama-3.2-1B-Instruct`

Model can be overridden via env: `GEMINI_MODEL`, `GROQ_MODEL`, etc.

**Client-side flow**: `useApiFetch` hook (reads `ProviderContext`) → POST with `{ provider, disabledProviders }` → API route → `callWithFallback` → sets `X-Provider-Used` header → `useApiFetch` updates context if provider changed.

---

## Flashcard Component (`src/components/Flashcard.tsx`)

4 study modes (tabs on card back):
- **study** — meaning + example sentence + synonyms/antonyms
- **write** — `WritingChallenge` (user writes a sentence, AI grades it)
- **fill** — `FillBlank` (fill-in-the-blank exercise)
- **dictation** — `DictationMode` (listen and type the sentence)

On first flip: fetches sentence + synonyms in parallel. Saved state is lazy (only after flip). Pronunciation button (`PronunciationButton`) floats on front face.

In **review mode** (`isReviewMode=true`): shows "Nhớ tốt ✓ / Quên ✗" buttons instead of save. Updates `mastery` and `reviewInterval` via `updateWordReview`, then pushes to Supabase.

---

## Custom Topics (`src/lib/custom-topics.ts`)

- `getCustomTopics()` — reads `localStorage["customTopics"]`
- `saveCustomTopic(topic)` — appends (deduplicates, case-insensitive, trims)
- `deleteCustomTopic(topic)` — removes by exact string match

Built-in topics (`"Daily Communication"`, `"TOEIC"`) are hardcoded in `TopicSelector.tsx` and cannot be deleted.

---

## Stats (`src/lib/stats.ts`)

- `getWordsPerDay(days)` → `DailyWordCount[]` — word counts from `learnedWords`
- `getTopicDistribution()` → `{ topic, count }[]`
- `getCalendarData(weeks)` → `CalendarDay[]` — heatmap levels 0–3
- `getStudyTimePerDay(days)` → `DailyStudyTime[]` — reads `localStorage["studyTime"]`, converts seconds → rounded minutes, fills missing days with 0

```ts
interface DailyStudyTime { date: string; minutes: number; }
```

---

## Spaced Repetition (`src/lib/storage.ts`)

- `getWordsForReview()` — returns words where `nextReviewAt <= now`
- `updateWordReview(word, remembered)`:
  - remembered=true: `interval = min(interval*2, 30)`, `mastery = min(mastery+1, 5)`
  - remembered=false: `interval = 1`, `mastery = max(mastery-1, 0)`
  - `nextReviewAt = now + interval * 86400000`

---

## Supabase Sync (`src/lib/sync.ts`)

No authentication. Identity = `syncKey` (UUID in localStorage, auto-generated).

**Tables**:
- `learned_words` — mirrors `LearnedWord` shape
- `daily_challenges` — mirrors `DailyChallenge`
- `custom_topics` — `{ sync_key, topic }`
- `user_settings` — `{ sync_key, voice_settings: jsonb }`

**Operations**:
- `initSync()` — bidirectional sync on app load; local→remote upsert, then remote→local merge (newer `learned_at` wins for words; `completed=true` wins for challenges)
- `pushWord(entry)` — fire-and-forget upsert
- `deleteWord(word)` — fire-and-forget delete
- `pushTopic(topic)` — fire-and-forget upsert
- `pushChallenge(record)` — fire-and-forget upsert
- `pullFromKey(key)` — one-way pull from another device's sync key; returns count of new words added

**Key alias**: `"thankz"` resolves to a hardcoded UUID (for easy sharing).

`VoiceSettings` is synced too: pushed on `initSync`, pulled and merged (device must have the voice URI available, otherwise `voiceURI` is nulled out).

Supabase client created per call via `createSupabase(syncKey)` in `src/lib/supabase.ts`.

---

## Key Constraints

1. **API keys are server-side only.** Never import `src/lib/providers/` or `src/lib/gemini.ts` from client components. Only API routes (`src/app/api/*/route.ts`) call them.
2. **`src/lib/gemini.ts`** is a legacy thin wrapper still used by some tests; new routes use `src/lib/providers/`.
3. **No auth / no user accounts.** All data keyed by `syncKey` (UUID).
4. **Firebase is hosting only.** No Firebase Firestore/Auth/Functions used. Config in `firebase.json` and `.firebaserc`.
5. **PWA**: offline support via `public/sw.js`. Manifest at `src/app/manifest.ts`.

---

## Component Map

| Component | Purpose |
|---|---|
| `FlashcardGrid` | Renders word grid, passes `onFlip` counter up |
| `TopicSelector` | Preset + custom topics; custom topics have a × delete button |
| `QuizMode` | Multiple-choice quiz over current word set |
| `ReadingMode` | Reading passage with comprehension questions |
| `WritingChallenge` | User writes a sentence; calls `/api/grade-sentence` |
| `FillBlank` | Displays fill-in-the-blank; validates answer |
| `DictationMode` | Plays TTS; user types what they hear |
| `PronunciationButton` | Web Speech API TTS button |
| `StreakCalendar` | 26-week calendar heatmap |
| `VoiceSettingsTab` | Voice picker + sliders |
| `SyncInitializer` | Runs `initSync()` on app mount |
| `ProviderBadge` | Shows current AI provider name |
| `HeaderTimer` | Navbar timer: shows today's study time or countdown; click to pause/resume; ＋ button opens SetCountdownModal; TimeUpModal shown when countdown ends |
| `charts/StudyTimeChart` | Bar chart — study minutes per day for last 30 days |

---

## Context Providers

### `ProviderContext` (`src/contexts/ProviderContext.tsx`)

`ProviderContextProvider` wraps the app. Exposes:
- `currentProvider` — active provider id
- `availableProviders` — fetched from `/api/providers` on mount
- `setProvider(id)` — sets preferred provider (persisted to localStorage)
- `disabledProviders` — list of opted-out provider ids
- `toggleProvider(id)` — enable/disable; auto-switches away if current is disabled

### `TimerContext` (`src/contexts/TimerContext.tsx`)

`TimerContextProvider` wraps inside `ProviderContextProvider` in `layout.tsx`. A single `setInterval` drives all timer state. Exposes via `useTimer()`:

```ts
todaySeconds: number          // total seconds studied today (increments while isRunning)
isRunning: boolean            // false when paused
isCountdownMode: boolean      // true when countdownRemaining !== null
countdownTarget: number|null  // original duration of the active countdown session (kept until clearTimeUp)
countdownRemaining: number|null  // seconds left; null when not in countdown
showTimeUp: boolean           // true when countdown just hit 0

pause()                       // stops the interval
resume()                      // restarts the interval
startCountdown(seconds)       // sets countdownTarget + countdownRemaining, resumes timer
stopCountdown()               // cancels countdown without triggering time-up modal
clearTimeUp()                 // dismisses time-up state, clears countdownTarget
```

Persistence: writes `todaySeconds` to `localStorage["studyTime"][YYYY-MM-DD]` with 5 s debounce. Reads on mount to restore today's value.

---

## Testing

Jest + `@testing-library/react`. Config: `jest.config.ts` + `jest.setup.ts`. Tests live alongside source in `__tests__/` folders. Run: `npm test`.
