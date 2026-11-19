# Multi-language learning, phase 1, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Learn words in English, Chinese, Japanese and Korean, one or several at once: language picker, multi-language word generation, review, and the garden filtered by language.

**Architecture:** A `lang` field (missing = `"en"`) is added to saved words and word-bank entries, and every lookup keys on (`lang`, word). `/api/generate-words` gains a `langs` body field; with more than English it returns concepts (one Vietnamese meaning, one word per language). English-only keeps today's response, card and flow unchanged; multi-language uses a new `ConceptCard` on Từ mới. Review stays one `Flashcard` per word, now language-aware.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind 3 tokens, Jest + Testing Library, puppeteer e2e (`npm run e2e`, `E2E_BASE`).

**Spec:** `docs/superpowers/specs/2026-11-19-multi-language-and-translator-design.md` (phase 1 plus the language-aware sentence/synonym routes the card back needs, moved forward from phase 2).

## Global Constraints

- Learning languages: `en`, `zh` (simplified), `ja`, `ko`. Meanings and explanations always Vietnamese.
- localStorage key `learningLanguages`: array, default `["en"]`, never empty.
- A word's identity is (`lang`, normalized word); `lang` missing means `"en"`. No data migration step.
- Old backup files (no `lang`) import as English.
- English-only (`["en"]`) must behave exactly as today: same `/api/generate-words` request and response, same `Flashcard`, same copy.
- Voice codes: `en-US`, `zh-CN`, `ja-JP`, `ko-KR`. HTML `lang`: `en`, `zh-CN`, `ja`, `ko`.
- Readings: pinyin (zh), kana (ja), Revised Romanization (ko); none for English.
- No new npm dependencies, no CJK web fonts: system font fallback only.
- API keys stay server-side; never import `src/lib/providers` from client code.
- Design: postcards, tokens, pills; update `CONTEXT.md` (pages, components, data model, localStorage keys).

## Review Focus

1. **A Chinese and a Japanese word with the same characters (学生).** Each keeps its own review date, plant and delete. Task 2 adds `saveLearnedWord keeps 学生 in zh and ja apart`.
2. **An existing English-only user after the update.** Words, due counts and the `/api/generate-words` request are unchanged. Task 2 adds `words without lang are English`; Task 4 adds `english-only request body is unchanged`.
3. **The AI omits a language or a reading in a concept.** Concepts missing a selected language are dropped, not shown half-empty, and a missing reading renders nothing. Task 4 adds `parseConcepts drops concepts missing a selected language`.
4. **A device with no Japanese or Korean voice.** The 🔊 button is disabled with a hint, not silent. Task 6 adds `disabled when no voice matches the language`.
5. **Unchecking every language in the picker.** The last checked language can't be unchecked. Task 1 adds `setLearningLanguages refuses an empty list`.

---

### Task 1: Languages module and learning-language setting

**Files:**
- Create: `src/lib/languages.ts`, `src/lib/useLearningLanguages.ts`
- Test: `src/lib/__tests__/languages.test.ts`

**Interfaces:**
- Produces:
  - `type LearnLang = "en" | "zh" | "ja" | "ko"`
  - `LEARN_LANGS: LearnLang[]`
  - `LANG_INFO: Record<LearnLang, { label: string; native: string; short: string; voice: string; htmlLang: string; reading?: string }>`. Labels: Tiếng Anh, Tiếng Trung, Tiếng Nhật, Tiếng Hàn. Native: English, 中文, 日本語, 한국어. Short: EN, 中, 日, 한. Reading: pinyin, kana, romanization.
  - `langOf(entry: { lang?: string }): LearnLang`: missing or unknown → `"en"`
  - `getLearningLanguages(): LearnLang[]`
  - `setLearningLanguages(langs: LearnLang[]): boolean`: returns false and stores nothing for an empty list; keeps `LEARN_LANGS` order; drops unknown codes
  - `LEARNING_LANGUAGES_KEY = "learningLanguages"`
  - `useLearningLanguages(): [LearnLang[], (langs: LearnLang[]) => void]`: re-reads on `storage` events and on a `learning-languages` window event that `setLearningLanguages` dispatches

- [ ] **Step 1: Write the failing tests** in `languages.test.ts`:
  - `default is english`: `getLearningLanguages()` equals `["en"]` with empty storage
  - `setLearningLanguages refuses an empty list`: `setLearningLanguages([])` is false, value stays `["en"]`
  - `order and unknown codes`: set `["ko","xx","en"]`, get equals `["en","ko"]`
  - `langOf`: `{}` → `"en"`, `{lang:"ja"}` → `"ja"`, `{lang:"fr"}` → `"en"`
- [ ] **Step 2: Run** `npm test -- --testPathPattern=languages`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement both files** (read/write with `readStored` from `lib/safe-json`).
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(lang): languages module and learning-language setting`

### Task 2: Saved words keyed by language

**Files:**
- Modify: `src/lib/storage.ts`, `src/lib/data-transfer.ts:95-97`
- Test: `src/lib/__tests__/storage-lang.test.ts`, `src/lib/__tests__/data-transfer.test.ts`

**Interfaces:**
- Consumes: `LearnLang`, `langOf` (Task 1)
- Produces:
  - `LearnedWord` gains `lang?: LearnLang; reading?: string; conceptId?: string`
  - `wordKey(lang: LearnLang, word: string): string` returns `${lang}:${word.trim().toLowerCase()}`
  - `saveLearnedWord(entry)` dedupes by `wordKey(langOf(entry), entry.word)`
  - `deleteLearnedWord(word: string, lang: LearnLang = "en")`
  - `reviewWord(word, quality, now = new Date(), lang: LearnLang = "en")`
  - `getWordsForReview(langs?: LearnLang[])`: all languages when omitted
  - `data-transfer` IDENTITY: `learnedWords` → `` `${x.lang ?? "en"}:${x.word}` ``; `wordBank` → `` `${x.lang ?? "en"}:${String(x.word).trim().toLowerCase()}` ``

- [ ] **Step 1: Write the failing tests:**
  - `saveLearnedWord keeps 学生 in zh and ja apart`: save both, both stored; saving `{word:"学生",lang:"zh"}` again returns false
  - `reviewWord only touches the given language`: review 学生/ja with 4; zh copy keeps `nextReviewAt`
  - `deleteLearnedWord removes one language`: delete 学生/zh; ja remains
  - `words without lang are English`: stored `{word:"apple"}`; `getWordsForReview(["en"])` includes it once due, `getWordsForReview(["zh"])` doesn't
  - In `data-transfer.test.ts`, `old backup without lang merges as English`: local `[{word:"apple",lang:"en"}]` plus file `[{word:"apple"}]` gives 1 word after `mergeData`
- [ ] **Step 2: Run** `npm test -- --testPathPattern="storage|data-transfer"`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the signatures above. Existing callers keep compiling because the new params default to `"en"`.
- [ ] **Step 4: Run** the same command plus `npx tsc --noEmit`. Expected: PASS, no type errors.
- [ ] **Step 5: Commit** `feat(lang): saved words keyed by language`

### Task 3: Word bank keyed by language, concept helpers

**Files:**
- Modify: `src/lib/word-bank.ts`
- Test: `src/lib/__tests__/word-bank.test.ts`

**Interfaces:**
- Consumes: `LearnLang`, `langOf`, `wordKey` (Tasks 1–2)
- Produces:
  - `BankWord` gains `lang?: LearnLang; reading?: string; conceptId?: string`
  - All dedupe, `known` and `learned` sets use `wordKey(langOf(entry), entry.word)`
  - `getUnseen(topic, limit, lang: LearnLang = "en")`
  - `markBankWordsSeen(words: string[], lang: LearnLang = "en")`
  - `countBank(topic?, lang: LearnLang = "en")`
  - `pickExcludeSample(topic, max = 200, lang: LearnLang = "en")`: only that language's words (Random still spans all topics)
  - `type Concept = { conceptId: string; meaning: string; words: Partial<Record<LearnLang, { word: string; reading?: string }>> }`
  - `getUnseenConcepts(topic: string, langs: LearnLang[], limit: number): Concept[]`: groups unseen entries by `conceptId`, keeps only groups with every language in `langs`, oldest first
  - `countConcepts(topic: string, langs: LearnLang[]): number`
  - `addConcepts(topic: string, concepts: Omit<Concept, "conceptId">[]): { added: number; persisted: boolean }`: one `BankWord` per language with a fresh `conceptId` (`crypto.randomUUID()`)
  - `markConceptsSeen(concepts: Concept[]): void`

- [ ] **Step 1: Write the failing tests:**
  - `same characters in zh and ja are two entries`
  - `getUnseenConcepts returns only complete concepts`: add one concept with en+zh and one with en only; `getUnseenConcepts("TOEIC", ["en","zh"], 5)` has length 1
  - `markConceptsSeen hides the concept`: after marking, `countConcepts` is 0
  - `pickExcludeSample filters by language`: zh call excludes English words
  - The existing tests stay green.
- [ ] **Step 2: Run** `npm test -- --testPathPattern=word-bank`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(lang): word bank keyed by language, concepts`

### Task 4: Multi-language word generation API

**Files:**
- Modify: `src/lib/gemini.ts`, `src/app/api/generate-words/route.ts`
- Test: `src/lib/__tests__/gemini.test.ts`, `src/app/api/__tests__/generate-words.test.ts` (create if missing)

**Interfaces:**
- Consumes: `LearnLang`, `LANG_INFO` (Task 1), `Concept` shape minus `conceptId` (Task 3)
- Produces:
  - `generateConcepts(topic: string, langs: LearnLang[], fn: GenerateFn, opts: { count?: number; exclude?: Partial<Record<LearnLang, string[]>>; knownCount?: number }): Promise<Omit<Concept,"conceptId">[]>`
  - `parseConcepts(text: string, langs: LearnLang[]): Omit<Concept,"conceptId">[]`
  - Route: body `langs?: string[]`. Missing, or exactly `["en"]`, takes the existing `generateWords` path and response. Otherwise it validates codes against `LEARN_LANGS` (400 on none valid), `exclude` becomes a per-language object (each list capped at 200), and the response is `{ concepts }`.
- Prompt contract: return a JSON array `[{"meaning": "<Vietnamese>", "words": {"en": {"word": "..."}, "zh": {"word": "...", "reading": "<pinyin with tone marks>"}, "ja": {"word": "...", "reading": "<kana>"}, "ko": {"word": "...", "reading": "<romanization>"}}}]` containing only the requested languages. Chinese is simplified. The Random topic uses the same wording as `generateWords`.

- [ ] **Step 1: Write the failing tests:**
  - `parseConcepts drops concepts missing a selected language`
  - `parseConcepts keeps a missing reading as undefined`
  - `generateConcepts prompt names each language and excludes per language`: the prompt contains `pinyin` and the zh exclude word
  - Route: `english-only request body is unchanged` (`{topic, count}` returns an array of `{word, meaning}`); `langs en+zh returns concepts`; `invalid langs → 400`
- [ ] **Step 2: Run** `npm test -- --testPathPattern="gemini|generate-words"`. Expected: FAIL.
- [ ] **Step 3: Implement.** Reuse `stripJsonCodeFence`. One retry for missing concepts, like `generateWords`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(lang): generate words in several languages`

### Task 5: Language-aware example sentences and synonyms

**Files:**
- Modify: `src/lib/gemini.ts` (`generateSentence`, `generateSynonyms`), `src/app/api/generate-sentence/route.ts`, `src/app/api/generate-synonyms/route.ts`
- Test: `src/lib/__tests__/gemini.test.ts`

**Interfaces:**
- Produces: `generateSentence(word, fn, lang: LearnLang = "en")`, `generateSynonyms(word, fn, lang: LearnLang = "en")`. The routes read an optional `lang` (invalid → `"en"`). Non-English prompts ask for a sentence in that language, followed by its reading on a second line.
- Response of `generate-sentence` for non-English: `{ sentence, reading?, translation }` (translation in Vietnamese); for English unchanged.

- [ ] **Step 1: Failing tests:** `generateSentence uses English by default` (the prompt contains "English"); `generateSentence in Japanese asks for kana and a Vietnamese translation`.
- [ ] **Step 2: Run** `npm test -- --testPathPattern=gemini`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(lang): example sentences and synonyms per language`

### Task 6: Pronunciation per language, CJK text rendering

**Files:**
- Modify: `src/components/PronunciationButton.tsx`, `tailwind.config.ts` (fontFamily `sans`, `en`)
- Create: `src/components/LangText.tsx`
- Test: `src/components/__tests__/PronunciationButton.test.tsx`

**Interfaces:**
- Produces:
  - `PronunciationButton({ word, lang = "en" })`: sets `utterance.lang` to `LANG_INFO[lang].voice`. Uses the saved `voiceURI` only if that voice's `lang` starts with the same 2 letters, otherwise the first voice with that prefix. With no voice for that prefix (once voices have loaded) the button is disabled with `title="Thiết bị chưa có giọng đọc <label>"`.
  - `LangText({ lang, word, reading?, size?: "lg" | "md" })`: renders the word with `lang={LANG_INFO[lang].htmlLang}` (`font-en` for English, `font-sans` for CJK) and the reading in small muted text under it
  - Font stacks gain, after the existing families: `"PingFang SC", "Hiragino Sans", "Apple SD Gothic Neo", "Noto Sans CJK SC", "Noto Sans CJK JP", "Noto Sans CJK KR", "Microsoft YaHei", "Malgun Gothic"`

- [ ] **Step 1: Failing tests:** `uses the language voice code` (mock `speechSynthesis`; clicking with `lang="ko"` speaks with `utterance.lang === "ko-KR"`); `disabled when no voice matches the language`.
- [ ] **Step 2: Run** `npm test -- --testPathPattern=PronunciationButton`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(lang): pronunciation and text rendering per language`

### Task 7: Language picker in the navigation

**Files:**
- Create: `src/components/LanguagePicker.tsx`
- Modify: `src/components/AppNavigation.tsx`
- Test: `src/components/__tests__/LanguagePicker.test.tsx`

**Interfaces:**
- Consumes: `useLearningLanguages`, `LANG_INFO`, `LEARN_LANGS` (Task 1)
- Produces: `<LanguagePicker />`, a `<details>` popover. The summary is a pill showing the selected `short` codes (e.g. `EN · 中`) with `aria-label="Ngôn ngữ học: Tiếng Anh, Tiếng Trung"`. The panel holds one checkbox row per language (`native` plus `label`). The last checked box is disabled. Placed in the sidebar under the brand and in the phone top bar before `HeaderTimer`.

- [ ] **Step 1: Failing tests:** `toggling adds a language` (check 中文, storage equals `["en","zh"]`); `last language cannot be unchecked` (only en checked, its checkbox is disabled).
- [ ] **Step 2: Run** `npm test -- --testPathPattern=LanguagePicker`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS. Check in the browser at 375px that the top bar doesn't overflow (brand, picker and timer on one row).
- [ ] **Step 5: Commit** `feat(lang): language picker`

### Task 8: Từ mới with several languages (concept cards, word job)

**Files:**
- Create: `src/components/ConceptCard.tsx`
- Modify: `src/app/page.tsx`, `src/contexts/WordJobContext.tsx`, `src/lib/word-job.ts` (job gains `langs`), `src/components/WordBankPanel.tsx`, `e2e/fixtures.js` (mock `{concepts}` when the body has `langs`)
- Test: `src/components/__tests__/ConceptCard.test.tsx`, `e2e/vocab-grammar.e2e.js`

**Interfaces:**
- Consumes: Tasks 1–6
- Produces:
  - `ConceptCard({ concept, topic, onFlip })`, a postcard:
    - **Front:** a `LangText` row per language with 🔊, the topic label, and "Chạm để lật thẻ".
    - **Back:** the Vietnamese meaning; per language, an example from `/api/generate-sentence` with `lang` (sentence, reading, translation).
    - **"Gieo vào vườn":** saves one `LearnedWord` per language with `lang`, `reading`, `conceptId`, the topic, and the example. The button becomes "Đã gieo".
  - Home: `langs = useLearningLanguages()[0]`.
    - `["en"]`: the existing code path unchanged.
    - Otherwise: `getUnseenConcepts(topic, langs, 5)`. When fewer than 5 come back, POST `/api/generate-words` `{topic, langs, count: 20, exclude: {lang: pickExcludeSample(topic, 200, lang)}, knownCount: countConcepts(topic, langs)}`, then `addConcepts`, then take 5. Render a grid of `ConceptCard`.
    - Bank text: "Ngân hàng: N nghĩa chưa học cho chủ đề này" (N from `countConcepts`).
  - Word job: `startJob(topic, target, langs)`; batches request concepts when `langs` isn't `["en"]`.

- [ ] **Step 1: Failing tests:**
  - `ConceptCard shows every language with its reading`
  - `saving stores one word per language with the same conceptId`
  - e2e `generates English and Chinese words`: seed `learningLanguages=["en","zh"]`, click "Gieo 5 từ mới", see 5 cards each containing the mock's Chinese word and its pinyin
- [ ] **Step 2: Run** `npm test -- --testPathPattern=ConceptCard`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** Jest, then `E2E_BASE=http://localhost:3200 node --test e2e/vocab-grammar.e2e.js` (dev server on 3200). Expected: PASS. English-only e2e is unchanged.
- [ ] **Step 5: Commit** `feat(lang): generate and save words in several languages`

### Task 9: Review per language

**Files:**
- Modify: `src/components/Flashcard.tsx`, `src/app/review/page.tsx`
- Test: `src/components/__tests__/Flashcard.test.tsx`, `src/app/review/__tests__/*` (add if missing)

**Interfaces:**
- Consumes: Tasks 2, 5, 6
- Produces:
  - `Flashcard` gains `lang?: LearnLang` (default `"en"`) and `reading?: string`.
    - **Front:** uses `LangText`.
    - **Calls:** `reviewWord(word, q, undefined, lang)`, `saveLearnedWord({... lang, reading})`, sentence and synonyms fetched with `lang`.
    - **Modes:** the write, fill and dictation tabs are hidden when `lang !== "en"` (phase 2 adds them).
    - **Back:** sibling words (same `conceptId`, other languages) appear as a small row "Cũng là: 中 学生 · 日 学生".
  - Review page:
    - Language chips (only shown when more than one language has saved words) filter `getWordsForReview(langs)`. The default is the learning languages.
    - Passes `lang` and `reading` to each card.
    - The summary still counts all graded cards.

- [ ] **Step 1: Failing tests:**
  - `grading a zh card reviews the zh word` (`reviewWord` mock called with `"学生", 4, undefined, "zh"`)
  - `non-English card hides typing modes`
  - Review page: `language chips filter the queue`
- [ ] **Step 2: Run** `npm test -- --testPathPattern="Flashcard|review"`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS; the existing Flashcard tests stay green.
- [ ] **Step 5: Commit** `feat(lang): review cards per language`

### Task 10: Garden, Vườn từ and Thống kê by language

**Files:**
- Modify: `src/components/GardenBed.tsx`, `src/app/history/page.tsx`, `src/app/stats/page.tsx`
- Test: `src/app/history/__tests__/page.test.tsx`

**Interfaces:**
- Consumes: Tasks 1, 2, 6
- Produces:
  - **GardenBed:** when saved words span more than one language, each soil label is prefixed with `LANG_INFO[lang].short` and renders the word via `LangText`.
  - **Vườn từ:**
    - A language `Segmented` ("Tất cả" plus each language present) next to the topic filter.
    - Words render via `LangText` with their reading.
    - Delete calls `deleteLearnedWord(word, lang)`.
    - React keys use `wordKey`.
  - **Thống kê:** the stage census and "Từ đã học" count respect the same language filter (a `Segmented` at the top of the overview tab when more than one language is present).

- [ ] **Step 1: Failing tests:**
  - `language filter shows only Chinese words`
  - `deleting a zh word keeps the ja word with the same characters`
- [ ] **Step 2: Run** `npm test -- --testPathPattern=history`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(lang): garden and stats by language`

### Task 11: Full verification and docs

**Files:**
- Modify: `CONTEXT.md`: the `learningLanguages` key, `LearnedWord`/`BankWord` fields, `lib/languages.ts`, `LanguagePicker`, `ConceptCard`, `LangText`, and the `generate-words` `langs`/`{concepts}` contract
- Modify: `e2e/contrast.e2e.js` seed: add a Chinese and a Japanese saved word, so contrast and overflow cover CJK text in both themes

- [ ] **Step 1:** `npx tsc --noEmit && npm test && npm run lint`. Expected: all pass.
- [ ] **Step 2:** Stop the dev server, `rm -rf .next && npm run build`, then `rm -rf .next`. Expected: "Compiled successfully".
- [ ] **Step 3:** Start the dev server on 3200, run `E2E_BASE=http://localhost:3200 npm run e2e`. Expected: 0 failures.
- [ ] **Step 4:** Manual check in the browser (375px and desktop, light and dark):
  - Pick EN and 中 and generate 5 words with real AI; readings show.
  - 🔊 speaks Chinese.
  - Save, then review the Chinese word.
  - Vườn từ filter works.
- [ ] **Step 5: Commit** `docs(lang): phase 1 context and e2e coverage`
