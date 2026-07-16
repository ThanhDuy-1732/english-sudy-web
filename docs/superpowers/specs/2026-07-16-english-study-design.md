# English Self-Study Website — Design Spec

**Date:** 2026-07-16
**Stack:** Next.js (App Router) + TailwindCSS + Google Gemini API (free tier)
**Storage:** localStorage (personal use, no auth)

---

## Goals

Build a personal English vocabulary study website with two core features:
1. Generate 5 vocabulary words by topic (Daily Communication, TOEIC)
2. AI-generated example sentence for each word

---

## User Flow

### Main page (`/`)
1. User selects a topic: **Daily Communication** or **TOEIC**
2. Clicks "Sinh từ mới" → calls `/api/generate-words` → Gemini returns 5 words with Vietnamese meanings
3. 5 flashcards appear in a grid
4. User clicks a card → it flips → back side shows Vietnamese meaning + AI example sentence (fetched on flip via `/api/generate-sentence`)
5. User clicks "Đã học ✓" on a flipped card → word is saved to localStorage

### History page (`/history`)
- Lists all words marked as learned, grouped or filterable by topic
- Each entry shows: word, meaning, example sentence, date learned
- User can delete individual words from history

---

## Architecture

### Pages
| Route | Purpose |
|-------|---------|
| `/` | Topic selection + flashcard study session |
| `/history` | Review all learned words |

### API Routes (server-side, Gemini key stays in `.env.local`)
| Route | Input | Output |
|-------|-------|--------|
| `POST /api/generate-words` | `{ topic: string }` | `[{ word, meaning }]` × 5 |
| `POST /api/generate-sentence` | `{ word: string }` | `{ sentence: string }` |

### File Structure
```
src/
├── app/
│   ├── page.tsx
│   ├── history/page.tsx
│   └── api/
│       ├── generate-words/route.ts
│       └── generate-sentence/route.ts
├── components/
│   ├── TopicSelector.tsx
│   ├── FlashcardGrid.tsx
│   └── Flashcard.tsx
└── lib/
    ├── gemini.ts      # Gemini API client wrapper
    └── storage.ts     # localStorage helpers
```

### localStorage Schema
```json
{
  "learnedWords": [
    {
      "word": "negotiate",
      "meaning": "đàm phán",
      "example": "We need to negotiate the terms of the contract.",
      "topic": "TOEIC",
      "learnedAt": "2026-07-16T07:00:00Z"
    }
  ]
}
```

---

## Gemini Prompts

**generate-words:**
> "Generate 5 English vocabulary words for the topic '{topic}'. For each word, provide the Vietnamese meaning. Return as JSON array: [{word, meaning}]."

**generate-sentence:**
> "Write one natural English example sentence using the word '{word}'. Return only the sentence, nothing else."

---

## Constraints
- Gemini free tier: 15 requests/minute — no rate-limit handling needed for personal use
- No user accounts, no backend database
- API key stored in `.env.local`, never exposed to the client
