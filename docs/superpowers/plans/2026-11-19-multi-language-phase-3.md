# Translator, phase 3 (text, three tones, playback), Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Dịch" page that translates between Vietnamese, English, Chinese, Japanese and Korean. Each translation comes in three tones (Thân mật, Lịch sự, Trang trọng), with a reading, a note on when to use it, 🔊 playback, copy, and "Gieo vào vườn". On phones, "Dịch" replaces "Luyện thi" in the tab bar.

**Architecture:** One AI call per translation (`/api/translate`, new task `translation`) returns all three tones as JSON validated with zod (`parseAiJson`, as in roleplay). A small client library holds the translator's languages, the last language pair and the 20 most recent translations in localStorage. Speech output gains a voice-code entry point so Vietnamese can be read aloud too.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind tokens, zod, Jest + Testing Library, puppeteer e2e.

**Spec:** `docs/superpowers/specs/2026-11-19-multi-language-and-translator-design.md`, sections "Giai đoạn 3: Trình dịch văn bản" and "Điều hướng" (the user chose: "Dịch" replaces "Luyện thi" in the phone tab bar; Luyện thi moves under "Thêm" and stays in the desktop sidebar).

## Global Constraints

- Translator languages: `vi`, `en`, `zh` (simplified), `ja`, `ko`; source can also be `auto`. Default pair Việt → Anh; the last used pair is remembered.
- Tones, in this order and with these labels: `casual` "Thân mật", `polite` "Lịch sự", `formal` "Trang trọng". Notes are in Vietnamese.
- Readings: pinyin (zh), kana (ja), Revised Romanization (ko); none for vi/en.
- Input limit: 1,000 characters (the client counts and blocks; the server rejects with 400).
- History: the last 20 translations on this device (text only), key `translationHistory`. Last pair: key `translatePair`.
- "Gieo vào vườn" is offered only when the target is a learning language (`en|zh|ja|ko`). It saves the phrase with `lang`, `reading`, the Vietnamese meaning, and topic `"Dịch"`.
- API keys stay server-side; design system classes (`postcard`, `btn`, `chip`, `field`, `Segmented`); `CONTEXT.md` updated.

## Review Focus

1. **The source language equals the target** (Việt → Việt, or auto-detected Vietnamese while the target is Vietnamese). The server returns 400 with a clear Vietnamese message instead of calling the AI; the page explains it. Task 2 adds `same source and target → 400`.
2. **The AI returns fewer than three tones, or an unknown tone name.** Unknown tones are dropped, missing ones simply don't show, and an empty result is an error the person sees. Task 1 adds `parseTranslation keeps known tones in order`.
3. **1,000 characters exactly vs 1,001.** 1,000 is accepted, 1,001 rejected, on both client and server. Task 2 adds `1001 characters → 400`; Task 3 adds `the counter blocks over 1000`.
4. **Copying where the clipboard API is missing or denied.** The button says it couldn't copy instead of failing silently. Task 3 adds `copy failure shows a message`.
5. **A learner with old English-only settings opens the tab bar.** "Luyện thi" is still reachable under "Thêm" and in the desktop sidebar. Task 4 adds `exams reachable from the Thêm sheet`.

---

### Task 1: Translator library (languages, parsing, history)

**Files:**
- Create: `src/lib/translate.ts`
- Modify: `src/lib/speech-voice.ts` (add `speakCode`)
- Test: `src/lib/__tests__/translate.test.ts`, `src/lib/__tests__/speech-voice.test.ts`

**Interfaces:**
- Produces:
  - `type TranslateLang = "vi" | LearnLang`
  - `TRANSLATE_LANGS: TranslateLang[]` (order vi, en, zh, ja, ko)
  - `TRANSLATE_INFO: Record<TranslateLang, { label: string; native: string; voice: string; htmlLang: string }>` (vi: "Tiếng Việt", "Tiếng Việt", `vi-VN`, `vi`; the rest come from `LANG_INFO`)
  - `type Tone = "casual" | "polite" | "formal"`
  - `TONES: { tone: Tone; label: string }[]` (labels from Global Constraints)
  - `interface TranslationResult { tone: Tone; text: string; reading?: string; note: string }`
  - `interface Translation { detected: TranslateLang; vietnamese: string; results: TranslationResult[] }`
  - `parseTranslation(raw: unknown): Translation | null`: keeps known tones in `TONES` order, at most one per tone, drops empty texts; returns `null` when no result remains or `detected` isn't a `TranslateLang`
  - `getTranslatePair(): { from: TranslateLang | "auto"; to: TranslateLang }`, default `{ from: "vi", to: "en" }`; `setTranslatePair(pair)`
  - `interface HistoryEntry { id: string; from: TranslateLang | "auto"; to: TranslateLang; text: string; translation: Translation; at: string }`
  - `getHistory(): HistoryEntry[]`, newest first; `addHistory(entry)` keeps 20 and replaces an entry with the same `text`+`to`
  - `MAX_TRANSLATE_CHARS = 1000`
  - `speakCode(text: string, voiceCode: string, settings: SpeechSettings): boolean` in `speech-voice.ts`: like `speakText` but for any BCP-47 code, with exact-match voice selection. `speakText` calls it.

- [ ] **Step 1: Failing tests:**
  - `parseTranslation keeps known tones in order`: input with formal, casual, `slang` and casual again gives `[casual, formal]`
  - `parseTranslation rejects empty results or an unknown detected language`
  - `history keeps 20, newest first, and replaces the same text and target`
  - `pair defaults to vi→en and is remembered`
  - `speakCode speaks Vietnamese with vi-VN`
- [ ] **Step 2: Run** `npm test -- --testPathPattern="translate|speech-voice"`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(translate): translator library`

### Task 2: `/api/translate`

**Files:**
- Create: `src/app/api/translate/route.ts`
- Modify: `src/lib/ai-tasks.ts` (task `translation`, provider `""`)
- Test: `src/app/api/__tests__/translate.test.ts`

**Interfaces:**
- Consumes: Task 1 `parseTranslation`, `TRANSLATE_LANGS`, `MAX_TRANSLATE_CHARS`
- Produces:
  - `POST { text, from: TranslateLang | "auto", to: TranslateLang }` → `200 Translation`
  - `400 { error }` for:
    - missing or empty text: "Nhập nội dung cần dịch."
    - more than 1,000 characters: "Tối đa 1.000 ký tự."
    - an unknown language
    - `from === to`, or the detected language equals `to`: "Ngôn ngữ nguồn và đích giống nhau."
  - `503` when the AI fails.
  - Prompt contract: the AI detects the source language (when `auto`) and translates into the target in three tones (casual, polite, formal), each natural for the target culture (honorifics for ja/ko, 您 vs 你 for zh). Each tone has a `reading` for zh/ja/ko and a one-sentence Vietnamese `note` on when to use it. The response also includes `vietnamese`, the meaning of the source in Vietnamese (the source itself if it's Vietnamese). It returns JSON only: `{"detected": "...", "vietnamese": "...", "results": [{"tone": "casual", "text": "...", "reading": "...", "note": "..."}, …]}`.
  - Validation: zod schema, then `parseTranslation`; one repair call through `parseAiJson`, as roleplay does.
  - `maxDuration = 300`.

- [ ] **Step 1: Failing tests** (mock `@/lib/ai-tasks`):
  - `translates vi→zh with three tones and pinyin reading requested`
  - `same source and target → 400`
  - `detected equals target → 400`
  - `1001 characters → 400` (and 1,000 is accepted)
  - `AI failure → 503`
- [ ] **Step 2: Run** `npm test -- --testPathPattern=api/__tests__/translate`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(translate): translation API with three tones`

### Task 3: The "Dịch" page

**Files:**
- Create: `src/app/translate/page.tsx`, `src/components/TranslationCard.tsx`
- Test: `src/app/translate/__tests__/page.test.tsx`, `src/components/__tests__/TranslationCard.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–2; `saveLearnedWord`, `isLearnLang`, `useVoiceSettings`, `LangText`
- Produces:
  - Page layout, as in the spec sketch:
    - `page-title` "Dịch".
    - Two `<select>`s (source with "Tự nhận", target) and a ⇄ swap button (disabled when the source is auto).
    - A `textarea.field` with a counter "n/1.000"; "Dịch" is disabled when empty or over the limit.
    - A loading state.
    - On error: a `role="alert"` message.
    - On success: when the source was auto, "Đã nhận: Tiếng Hàn". Then one `TranslationCard` per result.
    - The pair is saved on each translation.
  - History: a "Gần đây" list below (up to 20; tap to restore text, pair and results without calling the AI).
  - `TranslationCard({ result, to, vietnamese })`, a `postcard`:
    - The tone label, then the text with `lang`, the reading, and the note.
    - 🔊 calls `speakCode(text, TRANSLATE_INFO[to].voice, settings)`.
    - ⧉ copies with `navigator.clipboard.writeText`: "Đã chép" for 2 s, or "Không chép được" on failure.
    - "Gieo vào vườn" only when `isLearnLang(to)`; it saves `{ word: text, meaning: vietnamese, lang: to, reading, topic: "Dịch", example: "", learnedAt }`, then shows "Đã gieo".

- [ ] **Step 1: Failing tests:**
  - Page:
    - `translates and shows three tone cards` (mock `fetch`)
    - `the counter blocks over 1000`
    - `swap exchanges the languages`
    - `auto shows the detected language`
    - `history restores a past translation without fetching`
  - Card:
    - `copy failure shows a message`
    - `save is offered for Chinese but not Vietnamese`
    - `saving stores the phrase with lang, reading and Vietnamese meaning`
- [ ] **Step 2: Run** `npm test -- --testPathPattern="translate|TranslationCard"`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(translate): translator page with tone cards and history`

### Task 4: Navigation

**Files:**
- Modify: `src/components/AppNavigation.tsx`
- Test: `src/components/__tests__/AppNavigation.test.tsx` (create)

**Interfaces:**
- Produces:
  - `GROUPS[0]` links: Hôm nay, Dịch (`/translate`), Ôn tập.
  - `TABS`: Hôm nay, Từ mới, Ôn tập, Dịch. Luyện thi leaves the tab bar; the "Thêm" sheet already lists every link not in `TABS`, so it appears there under "Luyện".
  - `ICONS["/translate"]`: two overlapping speech bubbles, one containing 文 and one containing A, drawn as strokes on the 24-unit grid.

- [ ] **Step 1: Failing tests:**
  - `tab bar shows Dịch instead of Luyện thi`
  - `exams reachable from the Thêm sheet`
  - `sidebar lists Dịch`
- [ ] **Step 2: Run** `npm test -- --testPathPattern=AppNavigation`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS; check at 375px that the tab bar still fits.
- [ ] **Step 5: Commit** `feat(translate): Dịch in the navigation`

### Task 5: Verification and docs

**Files:**
- Modify: `CONTEXT.md` (page `/translate`, route, `lib/translate`, keys `translationHistory` and `translatePair`, navigation change), `e2e/fixtures.js` (mock `/api/translate`), `e2e/contrast.e2e.js` (add `/translate` to the scanned pages), and a new scenario in `e2e/vocab-grammar.e2e.js`: `translate vi→zh and save a tone`

- [ ] **Step 1:** `npx tsc --noEmit && npm test && npm run lint`. Expected: all pass.
- [ ] **Step 2:** Clean build (stop the dev server, `rm -rf .next && npm run build`, `rm -rf .next`). Expected: "Compiled successfully".
- [ ] **Step 3:** Dev server on 3300, then `E2E_BASE=http://localhost:3300 npm run e2e`. Expected: 0 failures.
- [ ] **Step 4:** Manual check with real AI, at 375px in both themes:
  - Việt → Trung "Xin chào, tôi muốn đặt bàn cho 2 người".
  - Auto → Việt on a Korean sentence.
  - Copy, 🔊, and saving to the garden.
- [ ] **Step 5: Commit** `docs(translate): phase 3 context and e2e coverage`
