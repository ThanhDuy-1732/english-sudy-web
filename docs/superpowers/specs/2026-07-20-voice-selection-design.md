# Voice Selection Design

**Date:** 2026-07-20
**Scope:** Cho phép người dùng chọn giọng đọc và điều chỉnh thông số phát âm (rate, pitch, volume) trong ứng dụng học từ vựng.

---

## 1. Data Model

```ts
interface VoiceSettings {
  voiceURI: string | null;  // null = giọng mặc định hệ thống
  rate: number;             // 0.1 – 2.0, default 0.9
  pitch: number;            // 0.0 – 2.0, default 1.0
  volume: number;           // 0.0 – 1.0, default 1.0
}

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  voiceURI: null,
  rate: 0.9,
  pitch: 1.0,
  volume: 1.0,
};
```

---

## 2. Storage & Persistence

- **localStorage:** key `"voiceSettings"`, lưu ngay khi người dùng thay đổi bất kỳ field nào.
- **Supabase sync:** Thêm column `voice_settings JSONB DEFAULT NULL` vào bảng sync.
  - **Push:** đính kèm `voice_settings: getVoiceSettings()` vào payload.
  - **Pull:** nếu response có `voice_settings`, validate `voiceURI` tồn tại trên thiết bị hiện tại. Nếu không → `voiceURI: null`, giữ nguyên rate/pitch/volume. Conflict resolution: last-write-wins.

---

## 3. Files To Create / Modify

### New files

| File | Mô tả |
|------|-------|
| `src/lib/voiceSettings.ts` | Pure functions: `getVoiceSettings()`, `saveVoiceSettings()`, `DEFAULT_VOICE_SETTINGS` |
| `src/lib/useVoiceSettings.ts` | React hook trả về `{ settings, update }` |
| `src/components/VoiceSettingsTab.tsx` | UI tab Voice trong Settings |

### Modified files

| File | Thay đổi |
|------|---------|
| `src/components/PronunciationButton.tsx` | Gọi `useVoiceSettings()`, áp settings vào utterance |
| `src/components/DictationMode.tsx` | Tương tự — thay hardcode rate bằng settings |
| `src/app/settings/page.tsx` | Thêm tab navigation + render `VoiceSettingsTab` |
| `src/lib/sync.ts` | Thêm `voice_settings` vào push payload và xử lý pull |
| `supabase/migrations/` | Migration thêm column `voice_settings JSONB` |

---

## 4. Hook Design

```ts
// src/lib/useVoiceSettings.ts
function useVoiceSettings() {
  const [settings, setSettings] = useState(() => getVoiceSettings())

  function update(partial: Partial<VoiceSettings>) {
    const next = { ...settings, ...partial }
    setSettings(next)
    saveVoiceSettings(next)
  }

  return { settings, update }
}
```

---

## 5. UI — Settings Tab Navigation

Trang `/settings` thêm tab navigation ở đầu:

```
[ AI Providers ]  [ Voice ]  [ Sync ]
```

### Tab "Voice" gồm 3 phần:

**Chọn giọng:**
- Dropdown liệt kê giọng `lang.startsWith("en")` từ `speechSynthesis.getVoices()`
- Mỗi option: `voice.name` + badge "Offline"/"Online" (`voice.localService`)
- Option đầu: "Mặc định hệ thống" (`voiceURI: null`)
- Nút "Thử nghe" phát câu "Hello, this is a test." với settings hiện tại

**Sliders:**
- **Tốc độ (Rate):** 0.5 – 2.0, step 0.1, default 0.9
- **Cao độ (Pitch):** 0.5 – 2.0, step 0.1, default 1.0
- **Âm lượng (Volume):** 0.0 – 1.0, step 0.1, default 1.0
- Mỗi slider hiển thị giá trị bên cạnh; lưu ngay với debounce 300ms

**Reset:**
- Nút "Reset về mặc định" → khôi phục `DEFAULT_VOICE_SETTINGS`

---

## 6. Edge Cases

- `speechSynthesis.getVoices()` trả về mảng rỗng lúc đầu trên Chrome (async load) → listen event `voiceschanged` để re-render danh sách.
- `voiceURI` từ thiết bị khác pull về không tồn tại trên thiết bị này → fallback `voiceURI: null`.
- `speechSynthesis` không tồn tại (SSR / unsupported browser) → guard `typeof window === "undefined"` như hiện tại.
