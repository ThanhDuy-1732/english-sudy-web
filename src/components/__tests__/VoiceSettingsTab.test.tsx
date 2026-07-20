import { fireEvent, render, screen } from "@testing-library/react";
import VoiceSettingsTab from "../VoiceSettingsTab";
import { DEFAULT_VOICE_SETTINGS } from "@/lib/voiceSettings";

const mockUpdate = jest.fn();

jest.mock("@/lib/useVoiceSettings", () => ({
  useVoiceSettings: () => ({ settings: DEFAULT_VOICE_SETTINGS, update: mockUpdate }),
}));

const mockSpeak = jest.fn();
const mockCancel = jest.fn();
const mockGetVoices = jest.fn().mockReturnValue([
  { voiceURI: "voice-1", name: "Samantha", lang: "en-US", localService: true },
  { voiceURI: "voice-2", name: "Google UK English", lang: "en-GB", localService: false },
  { voiceURI: "voice-3", name: "Google Deutsch", lang: "de-DE", localService: false },
]);

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(window, "SpeechSynthesisUtterance", {
    value: jest.fn().mockImplementation((text: string) => ({ text })),
    writable: true,
    configurable: true,
  });
  Object.defineProperty(global, "SpeechSynthesisUtterance", {
    value: window.SpeechSynthesisUtterance,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, "speechSynthesis", {
    value: {
      getVoices: mockGetVoices,
      speak: mockSpeak,
      cancel: mockCancel,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
    writable: true,
    configurable: true,
  });
});

test("renders voice dropdown with system default option", () => {
  render(<VoiceSettingsTab />);
  expect(screen.getByRole("combobox")).toBeInTheDocument();
  expect(screen.getByText("Mặc định hệ thống")).toBeInTheDocument();
});

test("renders english voices in dropdown", () => {
  render(<VoiceSettingsTab />);
  expect(screen.getByText("Samantha · Offline")).toBeInTheDocument();
  expect(screen.getByText("Google UK English · Online")).toBeInTheDocument();
  expect(screen.queryByText("Google Deutsch · Online")).not.toBeInTheDocument();
});

test("renders three slider labels", () => {
  render(<VoiceSettingsTab />);
  expect(screen.getByText("Tốc độ (Rate)")).toBeInTheDocument();
  expect(screen.getByText("Cao độ (Pitch)")).toBeInTheDocument();
  expect(screen.getByText("Âm lượng (Volume)")).toBeInTheDocument();
});

test("test button calls speechSynthesis.speak", () => {
  render(<VoiceSettingsTab />);
  fireEvent.click(screen.getByRole("button", { name: "Thử nghe" }));
  expect(mockSpeak).toHaveBeenCalledTimes(1);
  expect(mockCancel).toHaveBeenCalledTimes(1);
});

test("reset button calls update with DEFAULT_VOICE_SETTINGS", () => {
  render(<VoiceSettingsTab />);
  fireEvent.click(screen.getByRole("button", { name: "Reset về mặc định" }));
  expect(mockUpdate).toHaveBeenCalledWith(DEFAULT_VOICE_SETTINGS);
});

test("selecting a voice calls update with voiceURI", () => {
  render(<VoiceSettingsTab />);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "voice-1" } });
  expect(mockUpdate).toHaveBeenCalledWith({ voiceURI: "voice-1" });
});

test("selecting system default calls update with voiceURI null", () => {
  render(<VoiceSettingsTab />);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });
  expect(mockUpdate).toHaveBeenCalledWith({ voiceURI: null });
});
