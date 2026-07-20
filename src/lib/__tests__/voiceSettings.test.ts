import { DEFAULT_VOICE_SETTINGS, getVoiceSettings, saveVoiceSettings } from "../voiceSettings";

beforeEach(() => {
  localStorage.clear();
});

test("getVoiceSettings returns defaults when nothing saved", () => {
  expect(getVoiceSettings()).toEqual(DEFAULT_VOICE_SETTINGS);
});

test("saveVoiceSettings persists settings", () => {
  const settings = { voiceURI: "test-uri", rate: 1.2, pitch: 0.8, volume: 0.5 };
  saveVoiceSettings(settings);
  expect(getVoiceSettings()).toEqual(settings);
});

test("getVoiceSettings merges with defaults on partial data", () => {
  localStorage.setItem("voiceSettings", JSON.stringify({ rate: 1.5 }));
  const result = getVoiceSettings();
  expect(result.rate).toBe(1.5);
  expect(result.voiceURI).toBeNull();
  expect(result.pitch).toBe(DEFAULT_VOICE_SETTINGS.pitch);
  expect(result.volume).toBe(DEFAULT_VOICE_SETTINGS.volume);
});

test("getVoiceSettings returns defaults when JSON is corrupt", () => {
  localStorage.setItem("voiceSettings", "not-json");
  expect(getVoiceSettings()).toEqual(DEFAULT_VOICE_SETTINGS);
});
