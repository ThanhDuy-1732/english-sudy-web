# Model Switching Design

**Date:** 2026-07-17  
**Feature:** Multi-provider AI switching (auto + manual)

---

## Overview

Cho phép app tự động chuyển sang provider AI khác khi provider hiện tại bị vượt ngưỡng (429), và cho người dùng switch thủ công qua UI. Hiện tại chỉ có Gemini — các provider khác (Groq, HuggingFace) được bổ sung khi có API key trong `.env.local`.

---

## Architecture

### Approach: Client-driven Provider Selection

Client giữ `currentProvider` trong React context và gửi kèm theo mỗi API request. Server thực hiện auto-fallback nếu provider được yêu cầu thất bại, rồi trả về header `X-Provider-Used` để client đồng bộ lại state.

---

## Phần 1: Provider Layer (server-side)

### Cấu trúc file

```
src/lib/providers/
  types.ts           ← AIProvider interface
  gemini.ts          ← adapter Gemini (refactor từ src/lib/gemini.ts)
  openai-compat.ts   ← adapter dùng chung cho Groq, HuggingFace, v.v.
  index.ts           ← registry + callWithFallback
```

### Interface

```ts
// src/lib/providers/types.ts
export interface AIProvider {
  id: string;
  name: string;
  model: string;
  generateContent(prompt: string): Promise<string>;
}
```

### Provider Registry

`src/lib/providers/index.ts` đọc env khi khởi động:

- `GEMINI_API_KEY` → đăng ký GeminiProvider
- `GROQ_API_KEY` → đăng ký OpenAICompatProvider với baseURL Groq
- `HUGGINGFACE_API_KEY` → đăng ký OpenAICompatProvider với baseURL HuggingFace

Provider không có key **hoàn toàn bị bỏ qua** — không gây lỗi, không xuất hiện trong danh sách. Hiện tại chỉ có Gemini key nên chỉ Gemini được đăng ký.

Env vars cần bổ sung vào `.env.local`:

```
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-flash-latest          # optional, có default

GROQ_API_KEY=...                          # optional
GROQ_MODEL=llama-3.3-70b-versatile       # optional, có default

HUGGINGFACE_API_KEY=...                   # optional
HUGGINGFACE_MODEL=mistralai/Mistral-7B-v0.1  # optional, có default
```

### Auto-switch Logic

```ts
// src/lib/providers/index.ts
export async function callWithFallback(
  prompt: string,
  preferredId?: string
): Promise<{ text: string; providerId: string }>
```

1. Sắp xếp providers: `preferredId` lên đầu, các provider còn lại theo thứ tự đăng ký
2. Thử từng provider theo thứ tự
3. Nếu provider trả lỗi 429 hoặc 503 → thử provider tiếp theo
4. Nếu lỗi khác (400, 401, v.v.) → throw ngay, không fallback
5. Trả về `{ text, providerId }` — biết provider nào đã thực sự xử lý

### Thay đổi API Routes

Tất cả các route trong `src/app/api/*/route.ts`:

- Nhận thêm `provider?: string` từ request body
- Truyền vào `callWithFallback`
- Set header `X-Provider-Used: <providerId>` trên response

Các hàm trong `src/lib/gemini.ts` (generateWords, generateSentence, v.v.) được giữ nguyên signature nhưng nhận thêm param `generateContentFn: (prompt: string) => Promise<string>` thay vì tự gọi model nội bộ. Từng route truyền vào closure từ `callWithFallback`. Cách này giữ logic prompt tập trung ở `gemini.ts`, không phân tán vào routes.

---

## Phần 2: Session State & Client

### ProviderContext

```
src/contexts/ProviderContext.tsx
```

```ts
interface ProviderContextValue {
  currentProvider: string;
  availableProviders: { id: string; name: string; model: string }[];
  setProvider(id: string): void;
}
```

- Khởi tạo `currentProvider` từ `localStorage["preferredProvider"]`, fallback về provider đầu tiên trong danh sách
- `setProvider` cập nhật state + lưu vào `localStorage`
- Wrap toàn bộ app trong `src/app/layout.tsx`

### Endpoint GET `/api/providers`

```
src/app/api/providers/route.ts
```

Trả về providers đang hoạt động (có key):

```json
[
  { "id": "gemini", "name": "Gemini Flash", "model": "gemini-flash-latest" }
]
```

Client gọi endpoint này một lần khi `ProviderContext` mount.

### Auto-switch Sync

Mỗi `fetch` call tới API trong client wrapper:
1. Gắn `provider: currentProvider` vào request body
2. Đọc header `X-Provider-Used` từ response
3. Nếu khác `currentProvider` → gọi `setProvider(newId)` tự động

---

## Phần 3: UI

### Header Badge — `src/components/ProviderBadge.tsx`

- Hiển thị tên provider đang dùng, ví dụ: `⚡ Gemini Flash ▾`
- Click mở dropdown liệt kê `availableProviders`
- Click chọn provider → `setProvider(id)`
- Icon ⚙️ cạnh badge dẫn tới `/settings`
- Đặt trong `src/app/layout.tsx`, góc trên phải header

### Trang Settings — `src/app/settings/page.tsx`

Bảng tất cả provider (kể cả chưa cấu hình):

| Provider | Model | Trạng thái | Hành động |
|---|---|---|---|
| Gemini Flash | gemini-flash-latest | ✅ Active | Đang dùng / Dùng cái này |
| Groq | llama-3.3-70b | ⚠️ Chưa cấu hình | — |
| HuggingFace | Mistral-7B | ⚠️ Chưa cấu hình | — |

- Provider "Chưa cấu hình" hiển thị hint: `Thêm GROQ_API_KEY vào .env.local để kích hoạt`
- Nút "Dùng cái này" chỉ hiện với provider Active

---

## Data Flow

```
User request (page.tsx)
  → fetch("/api/generate-words", { body: { topic, provider: "gemini" } })
  → route.ts nhận provider="gemini"
  → callWithFallback(prompt, "gemini")
      → GeminiProvider.generateContent(prompt)
      → [429] → thử GroqProvider.generateContent(prompt)
      → [success] → return { text, providerId: "groq" }
  → route.ts set header X-Provider-Used: groq
  → client đọc header → setProvider("groq")
  → ProviderBadge cập nhật: "⚡ Groq ▾"
```

---

## Error Handling

| Lỗi | Hành vi |
|---|---|
| 429 (rate limit) | Auto-fallback sang provider tiếp theo |
| 503 (service unavailable) | Auto-fallback |
| 401 (invalid key) | Throw ngay, không fallback |
| 400 (bad request) | Throw ngay, không fallback |
| Tất cả provider đều thất bại | Trả 503 về client với message hiện tại |

---

## Testing

- Unit test `callWithFallback`: mock providers, kiểm tra fallback đúng thứ tự
- Unit test registry: chỉ đăng ký provider có key trong env
- Integration test từng adapter (Gemini, OpenAI-compat) với prompt thực
- Test `ProviderContext`: `setProvider` cập nhật state và localStorage
- Test header sync: response có `X-Provider-Used` → context tự cập nhật

---

## Constraints

- `GEMINI_API_KEY` và tất cả provider keys chỉ tồn tại server-side — không expose ra client
- Provider không có key bị bỏ qua hoàn toàn, không gây lỗi runtime
- Switch chỉ tồn tại trong session (localStorage cleared khi user muốn reset)
