import { act, renderHook } from "@testing-library/react";
import { useVoiceSettings } from "../useVoiceSettings";
import { DEFAULT_VOICE_SETTINGS } from "../voiceSettings";

beforeEach(() => {
  localStorage.clear();
});

test("initial settings come from localStorage (defaults when empty)", () => {
  const { result } = renderHook(() => useVoiceSettings());
  expect(result.current.settings).toEqual(DEFAULT_VOICE_SETTINGS);
});

test("initial settings reflect existing localStorage value", () => {
  localStorage.setItem("voiceSettings", JSON.stringify({ ...DEFAULT_VOICE_SETTINGS, rate: 1.5 }));
  const { result } = renderHook(() => useVoiceSettings());
  expect(result.current.settings.rate).toBe(1.5);
});

test("update() merges partial settings into state", () => {
  const { result } = renderHook(() => useVoiceSettings());
  act(() => {
    result.current.update({ rate: 1.5 });
  });
  expect(result.current.settings.rate).toBe(1.5);
  expect(result.current.settings.pitch).toBe(DEFAULT_VOICE_SETTINGS.pitch);
});

test("update() persists to localStorage", () => {
  const { result } = renderHook(() => useVoiceSettings());
  act(() => {
    result.current.update({ rate: 1.2, voiceURI: "test-uri" });
  });
  const saved = JSON.parse(localStorage.getItem("voiceSettings")!);
  expect(saved.rate).toBe(1.2);
  expect(saved.voiceURI).toBe("test-uri");
});
