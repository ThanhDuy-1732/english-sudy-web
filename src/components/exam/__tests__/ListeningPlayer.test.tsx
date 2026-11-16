import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import ListeningPlayer from "../ListeningPlayer";
import { playScript, stopPlayback } from "@/lib/exam/tts-player";
import type { AudioLine } from "@/lib/exam/types";

jest.mock("@/lib/exam/tts-player", () => ({
  playScript: jest.fn(),
  stopPlayback: jest.fn(),
}));

jest.mock("@/lib/exam/exam-storage", () => ({
  getExamSettings: jest.fn(() => ({
    primaryExam: "TOEIC",
    level: 3,
    listeningRate: 1,
    autoAdvance: false,
  })),
}));

const playScriptMock = playScript as jest.Mock;
const stopPlaybackMock = stopPlayback as jest.Mock;

const script: AudioLine[] = [
  { speaker: "M1", text: "Good morning." },
  { speaker: "W1", text: "How can I help you?" },
];

beforeEach(() => {
  playScriptMock.mockReset();
  stopPlaybackMock.mockReset();
});

test("renders the idle state and the script length is respected", () => {
  render(<ListeningPlayer script={script} />);
  expect(screen.getByLabelText("Phát audio")).toBeInTheDocument();
  expect(screen.getByText("Nhấn để nghe")).toBeInTheDocument();
});

test("plays the script and completes playback", async () => {
  let resolvePlay!: () => void;
  playScriptMock.mockImplementation((_script: AudioLine[], opts: { onLine: (i: number) => void }) => {
    opts.onLine(0);
    return new Promise<void>((resolve) => {
      resolvePlay = resolve;
    });
  });
  const onComplete = jest.fn();

  render(<ListeningPlayer script={script} onPlaybackComplete={onComplete} />);
  fireEvent.click(screen.getByLabelText("Phát audio"));

  expect(playScriptMock).toHaveBeenCalledTimes(1);
  expect(playScriptMock.mock.calls[0][0]).toEqual(script);
  expect(playScriptMock.mock.calls[0][1]).toMatchObject({ rate: 1 });
  expect(screen.getByText(/Đang phát… \(1\/2\)/)).toBeInTheDocument();

  await act(async () => {
    resolvePlay();
  });

  await waitFor(() => expect(screen.getByText("✓ Đã phát xong")).toBeInTheDocument());
  expect(onComplete).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Phát audio")).toHaveTextContent("🔁 Phát lại");
});

test("stops playback and returns to idle", async () => {
  playScriptMock.mockReturnValue(new Promise<void>(() => {}));

  render(<ListeningPlayer script={script} />);
  fireEvent.click(screen.getByLabelText("Phát audio"));
  fireEvent.click(screen.getByLabelText("Dừng"));

  expect(stopPlaybackMock).toHaveBeenCalled();
  expect(screen.getByText("Nhấn để nghe")).toBeInTheDocument();
});

test("returns to idle when playback throws", async () => {
  playScriptMock.mockRejectedValue(new Error("speech failed"));

  render(<ListeningPlayer script={script} />);
  fireEvent.click(screen.getByLabelText("Phát audio"));

  await waitFor(() => expect(screen.getByText("Nhấn để nghe")).toBeInTheDocument());
});

test("toggles the transcript", () => {
  render(<ListeningPlayer script={script} />);

  fireEvent.click(screen.getByText("Xem transcript"));
  expect(screen.getByText("Good morning.")).toBeInTheDocument();
  expect(screen.getByText("M1:")).toBeInTheDocument();

  fireEvent.click(screen.getByText("Ẩn transcript"));
  expect(screen.queryByText("Good morning.")).not.toBeInTheDocument();
});

test("stops playback when unmounted", () => {
  const { unmount } = render(<ListeningPlayer script={script} />);
  unmount();
  expect(stopPlaybackMock).toHaveBeenCalled();
});
