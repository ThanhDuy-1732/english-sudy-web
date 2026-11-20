# Translator, phase 4 (voice, photo, two-way conversation), Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the "Dịch" page, a learner can speak instead of typing (🎙), translate the text in a photo (📷, Gemini only), and open a two-way conversation screen for travel where each side taps their own big button, speaks, and hears the translation read aloud.

**Architecture:** Speech reuses `createRecorder` and `/api/speech/transcribe` (Groq Whisper), which learns to take Vietnamese and "auto" and to return a normalised language code. Photos are shrunk on the device (long edge ≤ 1,600 px, JPEG) and sent as base64 JSON to a new `/api/translate/image`, which calls a new image method that only `GeminiProvider` implements; `generateContent` is unchanged. Conversation turns call the existing `/api/translate` with a new optional `tone` so only the polite tone is generated.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind tokens, zod, `@google/generative-ai`, MediaRecorder, canvas, Jest + Testing Library, puppeteer e2e.

**Spec:** `docs/superpowers/specs/2026-11-19-multi-language-and-translator-design.md`, section "Giai đoạn 4: Giọng nói, ảnh, hội thoại hai chiều", plus "Ràng buộc" (Vercel ≈ 4.5 MB body, 300 s) and "Các quyết định do Claude đề xuất" (conversation uses one polite tone; 60 s per utterance).

## Global Constraints

- Languages and labels come from `lib/translate.ts` (`TranslateLang`, `TRANSLATE_INFO`, `TONES`). Explanations and UI copy are in Vietnamese.
- Recording: tap to start, tap to stop, auto-stop at **60 s**. Only one recording at a time on a screen.
- Photo: `<input type="file" accept="image/*" capture="environment">`; shrink to long edge **≤ 1,600 px**, JPEG quality **0.8**; the route's body limit is **4 MB** and it rejects decoded images over **2.9 MB** (413) and types other than `image/jpeg|png|webp` (415).
- Photo translation needs `GEMINI_API_KEY`. Without it the 📷 button is hidden on the page and Cài đặt shows: "Dịch ảnh cần khoá Gemini (GEMINI_API_KEY)."
- Conversation translates with **one tone, `polite`**, and reads the translation aloud with `speakCode`.
- Images and audio are never stored. Only typed/spoken text translations go into `translationHistory`; photo and conversation results do not.
- API keys stay server-side: nothing under `src/lib/providers/` is imported by a client file. Client calls use `useApiFetch().fetchWithProvider` for JSON routes and plain `fetch` with `FormData` for audio (as Shadowing does).
- Design classes: `postcard`, `btn`, `chip`, `field`; CJK text gets `lang` and `font-sans`, vi/en may use `font-en`. `CONTEXT.md` updated for every new route, page, component and storage key.

## Review Focus

1. **Microphone permission denied, or no MediaRecorder (iPhone over HTTP).** The person sees the recorder's Vietnamese message in `role="alert"` and can still type; nothing stays "recording". Task 2 adds `mic permission denied shows an alert and resets`.
2. **Whisper hears silence or returns an empty string.** No empty translation request is sent; the page says "Không nghe rõ, nói lại nhé." Task 2 adds `empty transcript does not translate`; Task 5 adds the same for a conversation turn.
3. **A huge or odd photo (a 12 MP camera photo, a PNG screenshot, a file the browser cannot decode).** It is shrunk before upload; a file that cannot be decoded shows "Không đọc được ảnh này." instead of crashing. Task 4 adds `undecodable image shows an error`.
4. **Tapping the other side's button while a turn is still being processed.** Both buttons are disabled until the turn finishes (or fails), so turns never interleave. Task 5 adds `buttons are disabled while a turn is processing`.
5. **Whisper's language names** ("vietnamese", "chinese", "japanese", "korean", "english", or something else). They are mapped to codes; anything else is `null` and the page keeps the chosen source. Task 1 adds `whisper language names map to codes`.

---

### Task 1: Transcribe accepts Vietnamese and auto, returns a language code

**Files:**
- Modify: `src/app/api/speech/transcribe/route.ts`
- Modify: `src/lib/translate.ts` (add `whisperLang`)
- Test: `src/app/api/__tests__/speech-transcribe.test.ts`, `src/lib/__tests__/translate.test.ts`

**Interfaces:**
- Produces:
  - `whisperLang(name: unknown): TranslateLang | null` in `lib/translate.ts`: `"vietnamese"→"vi"`, `"english"→"en"`, `"chinese"→"zh"`, `"japanese"→"ja"`, `"korean"→"ko"`, also accepts the codes themselves; case-insensitive; else `null`.
  - Form field `language`: a `TranslateLang` is sent to Whisper; `"auto"` sends no language; missing/unknown keeps today's `"en"` (Shadowing and IELTS rely on it).
  - Response gains `lang: TranslateLang | null` (= `whisperLang(data.language)`); existing fields unchanged.

- [ ] **Step 1: Failing tests:**
  - `whisper language names map to codes`: the five names plus `"ZH"` map as above; `"french"`, `undefined` → `null`
  - `language=vi is passed to Whisper`: upstream form has `language` = `vi`
  - `language=auto omits language`: upstream form has no `language` field
  - `response carries lang`: Groq mock returns `language: "korean"` → body `lang === "ko"`
  - `missing language still sends en` (guard the existing behaviour)
- [ ] **Step 2:** Run `npm test -- --testPathPattern="speech-transcribe|lib/__tests__/translate"`; expect the new tests to FAIL.
- [ ] **Step 3:** Implement `whisperLang` and the route changes; keep the `zh` simplified-Chinese prompt when `language === "zh"`.
- [ ] **Step 4:** Rerun; expect PASS.
- [ ] **Step 5:** Commit `feat(translate): transcribe Vietnamese and auto-detect`.

### Task 2: 🎙 Mic button in the translator

**Files:**
- Create: `src/components/MicButton.tsx`
- Modify: `src/app/translate/page.tsx`
- Test: `src/components/__tests__/MicButton.test.tsx`, `src/app/translate/__tests__/page.test.tsx`

**Interfaces:**
- Consumes: `createRecorder()` / `audioFilename()` from `lib/speech/recorder.ts`; Task 1's `{ text, lang }` response.
- Produces:
  - `MicButton({ language, onText, onError, disabled }: { language: TranslateLang | "auto"; onText: (text: string, lang: TranslateLang | null) => void; onError: (message: string) => void; disabled?: boolean; label?: string; className?: string })`.
  - States: idle (aria-label `label ?? "Nói"`), recording (aria-label "Dừng", shows elapsed seconds), sending (disabled, "Đang nghe…"). Auto-stops at 60 s. Disposes the recorder on unmount.
  - Posts `FormData { audio, language }` to `/api/speech/transcribe`. Trimmed empty text → `onError("Không nghe rõ, nói lại nhé.")`; HTTP error → `onError("Không nhận được giọng nói. Vui lòng thử lại.")`; recorder `start()` error → `onError(error.message)`.
  - Page: `MicButton` next to the textarea with `language={pair.from}`; `onText` sets the text and translates it at once (same path as the Dịch button, so the result goes to history). Errors use the page's existing `role="alert"`.

- [ ] **Step 1: Failing tests** (mock `@/lib/speech/recorder` and `fetch`; use `jest.useFakeTimers()` for the limit):
  - `tap to record, tap to stop, sends audio with the language` (form `language` = `zh` when the source is zh)
  - `stops by itself after 60 seconds`
  - `mic permission denied shows an alert and resets` (start rejects with "Permission denied" → `onError`, button back to "Nói")
  - `empty transcript does not translate` (page: `/api/translate` never called, alert "Không nghe rõ, nói lại nhé.")
  - page: `spoken text fills the box and translates`
- [ ] **Step 2:** Run the two test files; expect FAIL.
- [ ] **Step 3:** Implement `MicButton` and wire it into the page; move the body of `translate()` into `translateText(value: string)` so both the button and the mic call it.
- [ ] **Step 4:** Rerun; expect PASS.
- [ ] **Step 5:** Commit `feat(translate): speak instead of typing`.

### Task 3: Image method in the AI layer and `/api/translate/image`

**Files:**
- Modify: `src/lib/providers/types.ts`, `src/lib/providers/gemini.ts`, `src/lib/providers/index.ts`
- Modify: `src/lib/api-limits.ts` (add `"/api/translate/image": 4 * 1024 * KB`)
- Modify: `src/lib/translate.ts` (image result types and parser)
- Create: `src/app/api/translate/image/route.ts`
- Test: `src/lib/providers/__tests__/gemini.test.ts`, `src/app/api/__tests__/translate-image.test.ts`, `src/lib/__tests__/translate.test.ts`

**Interfaces:**
- Produces:
  - `interface ImageInput { mimeType: string; base64: string }` and `interface VisionProvider extends ProviderInfo { generateWithImage(prompt: string, image: ImageInput, opts?: GenerateOpts): Promise<string> }` in `types.ts`. `GeminiProvider` implements it (parts: `{ text }` and `{ inlineData: { mimeType, data } }`, same 429/500/503 retry as `generateContent`).
  - `getVisionProvider(): VisionProvider | undefined` in `providers/index.ts` (the registered Gemini provider, else undefined).
  - `interface ImageLine { text: string; translation: string; reading?: string }`, `interface ImageTranslation { detected: TranslateLang | null; lines: ImageLine[] }`, `parseImageTranslation(raw: unknown): ImageTranslation | null` in `lib/translate.ts` (drops lines with empty `text` or `translation`; `null` when none remain). `reading` is the reading of the **translation** when the target is zh/ja/ko.
  - `POST /api/translate/image` body `{ image: string /* data URL */, to: TranslateLang }` → `ImageTranslation`. Errors: no Gemini → 503 "Dịch ảnh cần khoá Gemini."; bad data URL or type → 415 "Ảnh không hợp lệ."; decoded > 2.9 MB → 413 "Ảnh quá lớn."; no text found (parser null) → 422 "Không thấy chữ trong ảnh."; AI failure → 503 "Không dịch được lúc này. Vui lòng thử lại.". `maxDuration = 300`. Prompt: read every line of text in the photo (signs, menus), translate each into the target in one natural tone, reading rules as in `/api/translate`, JSON only. `parseAiJson` repair goes through `generateWithImage` again.
  - Body limit 4 MB in `api-limits.ts` (below Vercel's 4.5 MB). Base64 adds a third, so 2.9 MB decoded is the largest image that fits; a comment says so. A 1,600 px JPEG at 0.8 is usually 300–600 KB.

- [ ] **Step 1: Failing tests:**
  - Gemini: `generateWithImage sends text and inline image parts` (mock `GoogleGenerativeAI`)
  - `parseImageTranslation drops empty lines and returns null when none remain`
  - Route (mock `getVisionProvider`): `translates a photo into lines`, `no Gemini → 503`, `png accepted, gif → 415`, `too large → 413`, `no text → 422`
- [ ] **Step 2:** Run the three files; expect FAIL.
- [ ] **Step 3:** Implement. Keep `generateContent` and `callTask` untouched.
- [ ] **Step 4:** Rerun plus `npm test -- --testPathPattern=api-limits`; expect PASS.
- [ ] **Step 5:** Commit `feat(translate): photo translation through Gemini`.

### Task 4: 📷 Photo button and result list

**Files:**
- Create: `src/lib/image-resize.ts`, `src/components/PhotoTranslate.tsx`
- Modify: `src/app/translate/page.tsx`, `src/app/settings/page.tsx`
- Test: `src/lib/__tests__/image-resize.test.ts`, `src/components/__tests__/PhotoTranslate.test.tsx`, `src/app/settings/__tests__/page.test.tsx`

**Interfaces:**
- Consumes: Task 3's route and `ImageTranslation`; `useProvider().availableProviders` (from `/api/providers`) to know whether Gemini is registered.
- Produces:
  - `fitSize(width: number, height: number, max = 1600): { width: number; height: number }` (keeps aspect ratio, never upscales, rounds to integers).
  - `shrinkImage(file: File): Promise<string>`: `createImageBitmap(file)` → canvas at `fitSize` → `canvas.toDataURL("image/jpeg", 0.8)`. Rejects with `Error("Không đọc được ảnh này.")` when decoding fails.
  - `PhotoTranslate({ to }: { to: TranslateLang })`: a 📷 `chip` (aria-label "Dịch ảnh") over a hidden file input with `accept="image/*" capture="environment"`; while working shows "Đang đọc ảnh…"; renders the lines as one `postcard` list: original (`lang` = detected), translation (`lang` = target), reading, 🔊 per translation via `speakCode`. Errors in `role="alert"`. Nothing is written to history.
  - Page renders `<PhotoTranslate to={pair.to} />` only when `availableProviders.some(p => p.id === "gemini")`.
  - Settings shows "Dịch ảnh cần khoá Gemini (GEMINI_API_KEY)." when Gemini is not in `availableProviders`.

- [ ] **Step 1: Failing tests:**
  - `fitSize`: `(4000, 3000) → (1600, 1200)`, `(1200, 3000) → (640, 1600)`, `(800, 600)` unchanged
  - `undecodable image shows an error` (`createImageBitmap` rejects → alert "Không đọc được ảnh này.", no fetch)
  - `a photo becomes translated lines` (mock `shrinkImage` and fetch; lines with readings render, `translationHistory` stays empty)
  - page: `photo button hidden without Gemini`, `shown with Gemini`
  - settings: `explains the Gemini key when missing`
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Rerun; expect PASS.
- [ ] **Step 5:** Commit `feat(translate): photo button and line-by-line results`.

### Task 5: Two-way conversation

**Files:**
- Modify: `src/app/api/translate/route.ts` (optional `tone`), `src/lib/translate.ts` (conversation pair)
- Create: `src/app/translate/conversation/page.tsx`
- Modify: `src/app/translate/page.tsx` (link "Hội thoại hai chiều")
- Test: `src/app/api/__tests__/translate.test.ts`, `src/app/translate/conversation/__tests__/page.test.tsx`, `src/lib/__tests__/translate.test.ts`

**Interfaces:**
- Consumes: Task 2's `MicButton`; `/api/translate`; `speakCode`; `useVoiceSettings`.
- Produces:
  - `/api/translate` accepts `tone?: Tone`. When set, the prompt asks for that one tone only and the response keeps only it; an unknown `tone` → 400 "Sắc thái không hợp lệ.".
  - `interface ConversationPair { me: TranslateLang; them: TranslateLang }`, `getConversationPair()` (default `{ me: "vi", them: "en" }`, key `conversationPair`), `setConversationPair(pair)`. `me !== them` is enforced by the page (changing one to equal the other swaps them).
  - Page `/translate/conversation`: two halves. Top half ("Họ nói · {native of them}") holds the other person's `MicButton` and can be rotated 180° with a "Xoay phía họ" toggle (`rotate-180` on that half, state not stored). Bottom half ("Tôi nói · {label of me}") holds mine. Each `MicButton` gets `language` = that side's language. One turn: transcript → `fetchWithProvider("/api/translate", { text, from: side, to: other, tone: "polite" })` → append `{ id, side, original, translation, reading? }` to an in-memory list → `speakCode(translation, TRANSLATE_INFO[other].voice, settings)`. The list shows both sentences with their `lang`; on the rotated half the other person's lines read the right way up.
  - While a turn is in flight both buttons are `disabled`. Failed turns show an alert and re-enable the buttons. Turns are not stored.

- [ ] **Step 1: Failing tests:**
  - Route: `tone=polite asks for one tone and returns only it`; `unknown tone → 400`
  - `conversation pair defaults to vi and en and is remembered`
  - Page (mock `MicButton` to call `onText` on click, mock fetch, spy `speakCode`): `my turn translates vi→en politely and reads it aloud`; `their turn translates en→vi`; `buttons are disabled while a turn is processing`; `empty transcript does not translate`; `Xoay phía họ rotates their half`
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Rerun; expect PASS.
- [ ] **Step 5:** Commit `feat(translate): two-way conversation mode`.

### Task 6: E2E, docs, full checks

**Files:**
- Modify: `e2e/fixtures.js` (mocks for `/api/speech/transcribe`, `/api/translate/image`, `/api/providers` with Gemini), `e2e/vocab-grammar.e2e.js`, `e2e/contrast.e2e.js` (add `/translate/conversation`)
- Modify: `CONTEXT.md`

**Interfaces:**
- Consumes: everything above. Fake recording in e2e through `newPage(..., { init })` with `page.evaluateOnNewDocument` defining `navigator.mediaDevices.getUserMedia` (returns an object with `getTracks: () => [{ stop() {} }]`) and a `MediaRecorder` stub whose `stop()` fires `ondataavailable` with a small `audio/webm` Blob and then `onstop`.

- [ ] **Step 1:** Scenarios:
  - `speak into the translator` (🎙 → Dừng → mocked transcript "Xin chào" fills the box → tone cards render)
  - `translate a photo` (`page.$('input[type=file]').uploadFile` a tiny PNG fixture → lines render; `translationHistory` unchanged)
  - `two-way conversation` (my turn then their turn → both lines render, mocked `/api/translate` saw `"tone":"polite"`; rotate toggle adds the rotation)
- [ ] **Step 2:** Update `CONTEXT.md`: transcribe `language`/`lang`, `/api/translate` `tone`, `/api/translate/image`, `VisionProvider`/`getVisionProvider`, `MicButton`, `PhotoTranslate`, `image-resize`, `/translate/conversation`, key `conversationPair`, Settings note.
- [ ] **Step 3:** Run `npx tsc --noEmit`, `npm run lint`, `npm test`, then with the dev server on: `E2E_BASE=http://localhost:3300 npm run e2e`; then stop the server and `rm -rf .next && npm run build`. All must pass.
- [ ] **Step 4:** Commit `test(translate): phase 4 e2e and docs`.
- [ ] **Step 5:** Manual check on an iPhone (spec "Kiểm thử"): mic permission prompt, Whisper on Vietnamese and Chinese, camera capture, Chinese/Japanese/Korean voices, rotated half readable.
