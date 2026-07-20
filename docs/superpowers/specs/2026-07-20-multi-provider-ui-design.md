# Multi-Provider Integration & Management UI

**Date:** 2026-07-20  
**Scope:** Add 4 new AI providers (OpenRouter, Mistral, Cohere, Replicate) + toggle on/off + test connection UI in Settings.

---

## Overview

The app already has a multi-provider architecture (`AIProvider` interface, `OpenAICompatProvider`, `GeminiProvider`, `callWithFallback` with 429/503 retry logic). This spec extends it from 3 providers (Gemini, Groq, HuggingFace) to 7, and adds provider management UI to the Settings page.

**Fallback order (when no preferred provider is set):**  
Gemini → Groq → OpenRouter → Mistral → Cohere → HuggingFace → Replicate

---

## 1. New Provider: ReplicateProvider

**File:** `src/lib/providers/replicate.ts`

Replicate uses a non-OpenAI-compatible async REST API:
1. `POST https://api.replicate.com/v1/models/{owner}/{name}/predictions` with `{ input: { prompt } }`
2. Poll `GET https://api.replicate.com/v1/predictions/{id}` until `status === "succeeded"` or `"failed"`
3. Return `output` (array of strings, joined)

Config:
- Env var: `REPLICATE_API_KEY`
- Default model: `meta/llama-4-scout-17b-16e-instruct` (overridable via `REPLICATE_MODEL`)
- Poll interval: 500ms, max 20 attempts (10s timeout)
- Error mapping: non-2xx status → throw with `{ status }`

---

## 2. Extended Provider Registry

**File:** `src/lib/providers/index.ts`

`buildRegistry()` adds 4 providers after HuggingFace:

| Provider   | Env var              | Default model                          | Base URL                                  |
|------------|----------------------|----------------------------------------|-------------------------------------------|
| OpenRouter | `OPENROUTER_API_KEY` | `meta-llama/llama-3.1-8b-instruct:free` | `https://openrouter.ai/api/v1`           |
| Mistral    | `MISTRAL_API_KEY`    | `mistral-small-latest`                 | `https://api.mistral.ai/v1`              |
| Cohere     | `COHERE_API_KEY`     | `command-r7b-12-2024`                  | `https://api.cohere.com/compatibility/v1` |
| Replicate  | `REPLICATE_API_KEY`  | `meta/llama-4-scout-17b-16e-instruct`  | (native REST)                             |

`callWithFallback` signature change:
```ts
callWithFallback(prompt: string, preferredId?: string, disabledIds?: string[]): Promise<{ text: string; providerId: string }>
```
Disabled providers are filtered out before the ordered list is built.

---

## 3. Test API Route

**File:** `src/app/api/providers/test/route.ts`

```
POST /api/providers/test
Body: { providerId: string }
```

- Looks up provider by ID in the registry
- Calls `provider.generateContent("Reply with just: OK")` with a 10-second AbortSignal timeout
- Returns `{ ok: true, latency: number }` or `{ ok: false, error: string }`
- Returns 404 if provider not in registry

---

## 4. Client: Toggle State in ProviderContext

**File:** `src/contexts/ProviderContext.tsx`

New additions to context value:
```ts
disabledProviders: string[]
toggleProvider: (id: string) => void
```

- Stored in `localStorage["disabledProviders"]` as JSON array
- `availableProviders` in context already excludes unconfigured providers (fetched from `/api/providers`); the disabled list is a separate client-side concept for providers that are configured but the user has turned off
- Toggling a provider that is currently `currentProvider` → automatically sets `currentProvider` to the first non-disabled available provider

---

## 5. Propagating Disabled Providers to API Routes

**File:** `src/lib/useApiFetch.ts`

Reads `disabledProviders` from context and adds `X-Disabled-Providers: groq,cohere` header to every fetch request.

**All API routes** that call `callWithFallback`:
- Read `request.headers.get("X-Disabled-Providers")` → split by comma → `disabledIds`
- Pass `disabledIds` to `callWithFallback`

Affected routes: `generate-words`, `generate-sentence`, `generate-batch`, `generate-fillblank`, `generate-reading`, `generate-synonyms`, `grade-sentence`.

---

## 6. Settings Page UI

**File:** `src/app/settings/page.tsx`

`ALL_PROVIDERS` constant updated with all 7 providers (add OpenRouter, Mistral, Cohere, Replicate with their env vars and default models).

**Two new columns in the providers table:**

### Toggle column
- Renders a toggle switch (on/off)
- Disabled (grayed out) if provider is not active (no API key configured)
- Calls `toggleProvider(id)` on change
- If toggling off the current preferred provider: auto-selects first available non-disabled provider and shows a brief notice

### Test column
- Renders a "Test" button
- Disabled if provider is not active
- On click: sets row into loading state, calls `POST /api/providers/test`, shows result:
  - `✅ 234ms` on success
  - `❌ rate limited` (or error message) on failure
- Result resets after 5 seconds

---

## 7. Environment Variables

**`.env.local`** — add:
```
GROQ_API_KEY=gsk_...
HUGGINGFACE_API_KEY=hf_...
OPENROUTER_API_KEY=sk-or-v1-...
COHERE_API_KEY=cohere_...
MISTRAL_API_KEY=zHCulj...
REPLICATE_API_KEY=r8_...
```

**`.env.local.example`** — add same keys with placeholder values.

---

## Data Flow

```
User clicks "Test" in Settings
  → POST /api/providers/test { providerId: "mistral" }
  → Server: find provider in registry → call generateContent("Reply with just: OK")
  → Return { ok: true, latency: 187 }
  → UI shows ✅ 187ms

User toggles off Groq
  → localStorage["disabledProviders"] = ["groq"]
  → ProviderContext.disabledProviders = ["groq"]
  → useApiFetch adds header X-Disabled-Providers: groq
  → POST /api/generate-words reads header → callWithFallback(prompt, preferred, ["groq"])
  → Groq skipped in fallback chain even if key is configured
```

---

## Out of Scope

- Changing model per provider from UI (can be done via env vars: `OPENROUTER_MODEL`, etc.)
- Persisting provider status server-side (toggle is client-only via localStorage)
- Provider usage analytics / cost tracking
