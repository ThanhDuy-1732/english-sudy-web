# Multi-language learning, phase 2 (practice per language), Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Practise Chinese, Japanese and Korean words like English ones: the card modes (write a sentence, fill the blank, dictation), the vocabulary quiz and the Từ mới quiz and reading, Từ trong ngữ cảnh, Shadowing and roleplay.

**Architecture:** Every AI route touched here takes an optional `lang` (default `"en"`; English prompts and responses unchanged). Answer checking goes through one helper that knows Chinese and Japanese have no spaces. Speech output goes through one voice helper, extracted from `PronunciationButton`. Speech input passes the language to Whisper. Pages choose a language from the learner's languages with a `Segmented` control, shown only when more than one is studied.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind tokens, Jest + Testing Library, puppeteer e2e.

**Spec:** `docs/superpowers/specs/2026-11-19-multi-language-and-translator-design.md`, section "Giai đoạn 2: Luyện tập theo ngôn ngữ". Phase 1 is shipped (`lib/languages.ts`, `lang` on words, `ConceptCard`, `LangText`, `generateExample`).

## Global Constraints

- Languages: `LearnLang` = `en | zh | ja | ko` from `src/lib/languages.ts`; `langOf(word)` for saved words.
- English-only must behave exactly as today: requests without `lang` and identical English prompts, copy and scoring.
- AI explanations, feedback, corrections and translations are in Vietnamese; practice content is in the word's language. Chinese is simplified.
- Readings: pinyin (zh), kana (ja), Revised Romanization (ko), shown under CJK sentences where the spec says so.
- When answers are checked, Chinese and Japanese compare without spaces or punctuation (CJK punctuation included). Korean compares like English (it has spaces).
- No new npm dependencies; API keys server-side only; design system classes (`postcard`, `chip`, `choice`, `btn`, `field`, `Segmented`).
- Update `CONTEXT.md` for every route, component and page contract changed.

## Review Focus

1. **A Chinese answer typed with spaces or full-width punctuation** (`我 是 学生。` vs `我是学生`) is accepted. Task 1 adds `answersMatch ignores spaces and CJK punctuation for zh/ja`.
2. **Korean is still checked word by word**, not merged into one string. Task 1 adds `korean keeps spaces as word boundaries`.
3. **An English-only learner sees no language selector** on any phase-2 page, and their requests carry no `lang`. Tasks 4–7 each add `english only: no language selector`.
4. **Whisper returns traditional characters or a different language** for a Chinese recording. Shadowing still scores by characters and doesn't crash. Task 6 adds `similarity tolerates an empty or foreign transcript`.
5. **A language with no saved words** is not offered in the quiz or context language selector. Tasks 4 and 5 add `languages without saved words are not offered`.

---

### Task 1: Answer matching and similarity per language

**Files:**
- Create: `src/lib/answer-match.ts`
- Test: `src/lib/__tests__/answer-match.test.ts`

**Interfaces:**
- Produces:
  - `normalizeAnswer(text: string, lang: LearnLang): string`: lowercase, trim, strip ASCII and CJK punctuation (`。，、！？；：「」『』（）“”‘’` plus `.,!?;:'"()`). For `zh`/`ja` it also removes all whitespace; for `en`/`ko` it collapses whitespace to one space.
  - `answersMatch(input: string, expected: string, lang: LearnLang): boolean`
  - `answerTokens(text: string, lang: LearnLang): string[]`: characters for `zh`/`ja` (after normalizing), words for `en`/`ko`
  - `similarityPct(target: string, spoken: string, lang: LearnLang): number`: 0–100, the share of target tokens present in the spoken tokens (a multiset match, so repeated characters count once each)

- [ ] **Step 1: Failing tests:**
  - `answersMatch ignores spaces and CJK punctuation for zh/ja` (`我 是 学生。` matches `我是学生`; `わたし は がくせい！` matches `わたしはがくせい`)
  - `korean keeps spaces as word boundaries` (`answerTokens("저는 학생입니다", "ko")` equals `["저는","학생입니다"]`)
  - `english unchanged` (`answersMatch(" Greet ", "greet", "en")` is true)
  - `similarityPct by characters for zh` (target `我是学生`, spoken `我是老师` gives 50)
  - `similarityPct handles empty spoken` (gives 0)
- [ ] **Step 2: Run** `npm test -- --testPathPattern=answer-match`. Expected: FAIL, module missing.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(lang): answer matching per language`

### Task 2: Shared voice helper and language-aware AI prompts

**Files:**
- Create: `src/lib/speech-voice.ts`
- Modify: `src/components/PronunciationButton.tsx` (use the helper), `src/lib/gemini.ts` (`generateFillBlank`, `gradeSentence`, `generateReading`), `src/app/api/generate-fillblank/route.ts`, `src/app/api/grade-sentence/route.ts`, `src/app/api/generate-reading/route.ts`, `src/app/api/vocab/context/route.ts`, `src/app/api/speech/transcribe/route.ts`
- Test: `src/lib/__tests__/speech-voice.test.ts`, `src/lib/__tests__/gemini.test.ts`, `src/app/api/__tests__/speech-transcribe.test.ts`, route tests

**Interfaces:**
- Produces:
  - `voicesFor(lang): SpeechSynthesisVoice[]`
  - `pickVoice(lang, savedVoiceURI: string | null): SpeechSynthesisVoice | null`: the saved voice if it speaks the language, else an exact `LANG_INFO[lang].voice` match, else `null` (the rule from the phase 1 review)
  - `speakText(text: string, lang: LearnLang, settings: { voiceURI: string | null; rate: number; pitch: number; volume: number }): boolean`: false when speech is unavailable
  - `generateFillBlank(word, fn, lang = "en")`: non-English returns `{ sentence, reading?, translation }` with `_____` in place of the word
  - `gradeSentence(word, sentence, fn, lang = "en")`: the prompt grades a sentence in that language; feedback stays Vietnamese
  - `generateReading(words, fn, lang = "en")`: the passage and questions in that language, plus `translation` (Vietnamese) when not English
  - `vocab/context` body gains `lang`. For CJK the prompt asks for each sentence followed by its reading in parentheses on the next line, then a Vietnamese translation at the end.
  - `speech/transcribe` form field `language` (one of `en|zh|ja|ko`); missing keeps `"en"`. The response adds `language` from Whisper's `verbose_json`.
  - Each route reads `lang` with `isLearnLang(raw) ? raw : "en"` and sends it to the library only when it isn't English.

- [ ] **Step 1: Failing tests:**
  - `pickVoice exact match else null` (the cases from `PronunciationButton.test.tsx` move here)
  - `generateFillBlank in Chinese asks for pinyin and a Vietnamese translation`
  - `gradeSentence in Korean names Korean and keeps Vietnamese feedback`
  - `generateReading in Japanese asks for a Japanese passage`
  - `transcribe forwards language=zh to Whisper` (the existing transcribe test style: mock `fetch`, inspect the `FormData`)
  - `transcribe without language keeps en`
- [ ] **Step 2: Run** `npm test -- --testPathPattern="speech-voice|gemini|transcribe|fillblank|grade-sentence|reading"`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.** `PronunciationButton` keeps its behaviour and tests, now calling `pickVoice`/`voicesFor`.
- [ ] **Step 4: Run.** Expected: PASS, including the existing `PronunciationButton` tests.
- [ ] **Step 5: Commit** `feat(lang): voice helper and language-aware practice prompts`

### Task 3: Card modes in every language

**Files:**
- Modify: `src/components/Flashcard.tsx` (show write, fill and dictation for all languages), `src/components/WritingChallenge.tsx`, `src/components/FillBlank.tsx`, `src/components/DictationMode.tsx`
- Test: `src/components/__tests__/Flashcard.test.tsx`, `src/components/__tests__/FillBlank.test.tsx`, `src/components/__tests__/DictationMode.test.tsx` (create the missing ones)

**Interfaces:**
- Consumes: Task 1 `answersMatch`, `answerTokens`; Task 2 `speakText`, the `lang` request bodies
- Produces:
  - `WritingChallenge({ word, lang = "en" })` posts `lang` (non-English only); its placeholder says "Viết một câu tiếng <label> có từ …"
  - `FillBlank({ word, sentence, lang = "en", reading?, translation? })` checks with `answersMatch`, shows the reading and translation under the sentence for CJK, and widens the input to `w-32`
  - `DictationMode({ sentence, lang = "en" })` plays with `speakText(sentence, lang, settings)` and highlights by `answerTokens` (characters for zh/ja)
  - `Flashcard` keeps the 4 mode tabs for every language (it drops the phase-1 hide). The fill request carries `lang`, and the result's `reading`/`translation` pass to `FillBlank`.

- [ ] **Step 1: Failing tests:**
  - `zh card shows the typing modes`
  - `FillBlank accepts 学生 typed with a trailing space and 。`
  - `DictationMode marks a correct Chinese sentence as all-correct characters`
  - `DictationMode speaks with zh-CN`
  - Update the phase-1 test `non-English card hides typing modes` to `non-English card shows the typing modes` (it asserts the opposite now).
- [ ] **Step 2: Run** `npm test -- --testPathPattern="Flashcard|FillBlank|DictationMode|WritingChallenge"`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(lang): card practice modes in every language`

### Task 4: Quizzes per language

**Files:**
- Modify: `src/lib/vocab-quiz.ts`, `src/app/vocab/quiz/page.tsx`, `src/components/QuizMode.tsx`, `src/components/QuizCard.tsx`, `src/app/page.tsx` (quiz and reading buttons for several languages)
- Test: `src/lib/__tests__/vocab-quiz.test.ts`, `src/app/vocab/quiz/__tests__/page.test.tsx` (create)

**Interfaces:**
- Produces:
  - `quizWords(words, lang: LearnLang = "en")` filters by language (replaces the phase-1 English-only rule)
  - `buildMCQ(word, pool)` takes distractors only from words of the same language (callers pass a same-language pool)
  - `quizLanguages(words, learning: LearnLang[]): LearnLang[]`: learning languages with at least 4 saved words, in `LEARN_LANGS` order
  - `/vocab/quiz`:
    - The setup gets a "Ngôn ngữ" `Segmented` when `quizLanguages` has more than one entry.
    - The question shows the word via `LangText` with its reading.
    - Fill mode builds the blank with a plain substring replace for CJK (no `\b`), sends `lang` to `generate-fillblank`, and checks with `answersMatch`.
  - `QuizMode({ words, lang = "en" })`: `words` gains an optional `lang` per word, and distractors come from history of the same language.
  - Home with several languages:
    - "Kiểm tra kiến thức" quizzes every word of the shown concepts (each question in its own language).
    - "Đọc hiểu" asks which language (one `chip` per selected language, shown inline) and generates the passage with `lang`.
    - `ReadingMode` shows the Vietnamese `translation` under the passage when present.

- [ ] **Step 1: Failing tests:**
  - `quizWords filters by language`
  - `quizLanguages needs 4 words` (`languages without saved words are not offered`)
  - Page: `english only: no language selector`; `choosing 中文 quizzes Chinese words` (seed 4 zh words, pick 中文, start; the first question shows a Chinese word and its options are Vietnamese meanings of Chinese words)
- [ ] **Step 2: Run** `npm test -- --testPathPattern="vocab-quiz|vocab/quiz"`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(lang): quizzes and reading per language`

### Task 5: Từ trong ngữ cảnh per language

**Files:**
- Modify: `src/app/vocab/context/page.tsx`
- Test: `src/app/vocab/context/__tests__/page.test.tsx`

**Interfaces:**
- Consumes: Task 2 `vocab/context` `lang`
- Produces:
  - A "Ngôn ngữ" `Segmented` over learning languages that have saved words (shown when more than one).
  - The word chips list words of the chosen language (deduped by spelling within it) via `lang` attributes.
  - Generation posts `lang` (non-English only).
  - The output postcard sets `lang` on the content.
  - Switching language clears the selection.
  - This replaces the phase-1 ruling that showed each spelling once across languages.

- [ ] **Step 1: Failing tests:**
  - `english only: no language selector`
  - `languages without saved words are not offered`
  - `choosing 日本語 lists only Japanese words and sends lang=ja`
  - Update the phase-1 test `a spelling saved in two languages is listed once`: per language, 学生 shows once under 中文 and once under 日本語.
- [ ] **Step 2: Run** `npm test -- --testPathPattern=vocab/context`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(lang): words in context per language`

### Task 6: Shadowing per language

**Files:**
- Create: `src/lib/shadow-sentences.ts`
- Modify: `src/app/speak/shadowing/page.tsx`
- Test: `src/lib/__tests__/shadow-sentences.test.ts`, `src/app/speak/shadowing/__tests__/page.test.tsx` (create)

**Interfaces:**
- Consumes: Task 1 `similarityPct`; Task 2 `speakText`, the transcribe `language`
- Produces:
  - `SHADOW_SENTENCES: Record<LearnLang, { text: string; reading?: string; translation: string }[]>`: 8 everyday sentences per language. English keeps today's 8 sentences verbatim. Chinese, Japanese and Korean get natural sentences with readings and Vietnamese translations, written by the implementer.
  - Page:
    - A "Ngôn ngữ" `Segmented` over learning languages (shown when more than one).
    - The sentence postcard shows `text` (with `lang`), the reading, and the translation.
    - "Nghe câu mẫu" calls `speakText(text, lang, settings)`.
    - Recording sends `language` to transcribe.
    - The score uses `similarityPct(text, transcript, lang)`.
    - The saved session keeps today's fields, plus `lang` on the stored record.
  - The local `similarity()` is deleted.

- [ ] **Step 1: Failing tests:**
  - `every language has 8 sentences, CJK with readings`
  - `english sentences unchanged` (the first English sentence equals "The meeting has been postponed until next Thursday.")
  - Page: `english only: no language selector`; `similarity tolerates an empty or foreign transcript` (mock transcribe returning `""`, then `"Hello"` for a zh sentence; the score shows 0% and no error)
- [ ] **Step 2: Run** `npm test -- --testPathPattern=shadow`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(lang): shadowing per language`

### Task 7: Roleplay per language

**Files:**
- Modify: `src/app/api/speak/roleplay/route.ts`, `src/app/speak/roleplay/[id]/page.tsx`, `src/lib/speech/types.ts` (turn `reading?`)
- Test: `src/app/api/__tests__/speak-roleplay.test.ts`, `src/app/speak/roleplay/__tests__/page.test.tsx` (create if missing)

**Interfaces:**
- Produces:
  - Route body gains `lang`. For non-English, the prompt says:
    - the AI speaks that language in character;
    - `reply` is in that language, plus `reading`;
    - `suggestedReplies` are in that language;
    - `correction.note` is in Vietnamese.
  - English prompt unchanged.
  - Page:
    - Before the first message, a "Ngôn ngữ" `Segmented` over learning languages (shown when more than one, default `en` if studied, else the first).
    - The language locks once the conversation starts.
    - AI bubbles show `reading` under the text.
    - The input placeholder names the language.
    - The saved speaking record stores `lang`.

- [ ] **Step 1: Failing tests:**
  - Route: `english prompt unchanged without lang` (snapshot the prompt string passed to the `callTask` mock against the current one); `zh prompt asks for Chinese reply, reading and Vietnamese note`
  - Page: `english only: no language selector`; `language locks after the first message`
- [ ] **Step 2: Run** `npm test -- --testPathPattern=roleplay`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(lang): roleplay per language`

### Task 8: Verification and docs

**Files:**
- Modify: `CONTEXT.md` (routes' `lang`, `answer-match`, `speech-voice`, `shadow-sentences`, page selectors), `e2e/fixtures.js` (mocks answer zh when the body has `"lang":"zh"`), `e2e/vocab-grammar.e2e.js` (a scenario `practise a Chinese card: fill-blank and quiz`)

- [ ] **Step 1:** `npx tsc --noEmit && npm test && npm run lint`. Expected: all pass.
- [ ] **Step 2:** Stop the worktree dev server, `rm -rf .next && npm run build`, `rm -rf .next`. Expected: "Compiled successfully".
- [ ] **Step 3:** Start the dev server on 3300, `E2E_BASE=http://localhost:3300 npm run e2e`. Expected: 0 failures.
- [ ] **Step 4:** Manual check with real AI, at 375px in both themes:
  - Fill-in and write-a-sentence on a Chinese card.
  - Shadowing a Japanese sentence (play the sample, then record or type).
  - A Korean roleplay message.
  - Từ trong ngữ cảnh in Chinese.
- [ ] **Step 5: Commit** `docs(lang): phase 2 context and e2e coverage`
