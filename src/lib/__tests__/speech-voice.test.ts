import { pickVoice, speakText, voicesFor } from "../speech-voice";

type V = { voiceURI: string; lang: string };
let voices: V[] = [];
const speak = jest.fn();
class FakeUtterance { text: string; lang = ""; voice: V | null = null; rate = 1; pitch = 1; volume = 1; constructor(t: string) { this.text = t; } }

beforeEach(() => {
  speak.mockReset();
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { getVoices: () => voices, speak, cancel: jest.fn() } });
  (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = FakeUtterance;
});

test("pickVoice: saved voice if it speaks the language, else exact match, else null", () => {
  voices = [{ voiceURI: "gb", lang: "en-GB" }, { voiceURI: "us", lang: "en-US" }, { voiceURI: "hk", lang: "zh-HK" }];
  expect(pickVoice("en", "gb")?.voiceURI).toBe("gb");
  expect(pickVoice("en", null)?.voiceURI).toBe("us");
  expect(pickVoice("zh", "gb")).toBeNull();
  expect(voicesFor("zh").map((v) => v.voiceURI)).toEqual(["hk"]);
});

test("speakText speaks in the language with the settings", () => {
  voices = [{ voiceURI: "ja", lang: "ja-JP" }];
  expect(speakText("水", "ja", { voiceURI: null, rate: 0.8, pitch: 1, volume: 1 })).toBe(true);
  const utterance = speak.mock.calls[0][0];
  expect(utterance.lang).toBe("ja-JP");
  expect(utterance.voice.voiceURI).toBe("ja");
  expect(utterance.rate).toBe(0.8);
});
