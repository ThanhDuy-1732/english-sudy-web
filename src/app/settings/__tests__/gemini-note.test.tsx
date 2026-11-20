import { act, render, screen } from "@testing-library/react";
import SettingsPage from "../page";

jest.mock("@/lib/speech/audio-store", () => ({
  getAudioCount: jest.fn().mockResolvedValue(0),
  clearAllAudio: jest.fn().mockResolvedValue(0),
}));

let providers: { id: string; name: string; model: string }[] = [];
jest.mock("@/contexts/ProviderContext", () => ({
  useProvider: () => ({
    currentProvider: "opencode",
    availableProviders: providers,
    setProvider: jest.fn(),
    disabledProviders: [],
    toggleProvider: jest.fn(),
  }),
}));

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ json: async () => [] }) as jest.Mock;
});

const NOTE = "Dịch ảnh cần khoá Gemini (GEMINI_API_KEY).";

test("explains the Gemini key when missing", async () => {
  providers = [{ id: "opencode", name: "OpenCode", model: "m" }];
  await act(async () => {
    render(<SettingsPage />);
  });
  expect(screen.getByText(NOTE)).toBeInTheDocument();
});

test("no note when Gemini is configured", async () => {
  providers = [{ id: "gemini", name: "Gemini", model: "m" }];
  await act(async () => {
    render(<SettingsPage />);
  });
  expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
});
