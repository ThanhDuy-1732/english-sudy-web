import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ConversationPage from "../page";
import { speakCode } from "@/lib/speech-voice";

// Each mic hands the page a transcript on click; an empty transcript goes to onError like the real MicButton.
const transcripts: Record<string, string> = { "Tôi nói": "Xin chào", "Họ nói": "Hello" };
jest.mock("@/components/MicButton", () => ({
  MicButton: ({
    label,
    disabled,
    onText,
    onError,
    onActiveChange,
  }: {
    label: string;
    disabled?: boolean;
    onText: (t: string, l: null) => void;
    onError: (m: string) => void;
    onActiveChange?: (active: boolean) => void;
  }) => (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => (transcripts[label].trim() ? onText(transcripts[label], null) : onError("Không nghe rõ, nói lại nhé."))}
      >
        {label}
      </button>
      <button type="button" onClick={() => onActiveChange?.(true)}>
        {`ghi âm ${label}`}
      </button>
    </>
  ),
}));

jest.mock("@/lib/useApiFetch", () => ({
  useApiFetch: () => ({
    fetchWithProvider: (url: string, body: Record<string, unknown>) =>
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  }),
}));

jest.mock("@/lib/speech-voice", () => ({ ...jest.requireActual("@/lib/speech-voice"), speakCode: jest.fn() }));

const originalFetch = global.fetch;

function reply(text: string, detected = "vi") {
  return { ok: true, json: async () => ({ detected, vietnamese: "", results: [{ tone: "polite", text, note: "" }] }) };
}

beforeEach(() => {
  localStorage.clear();
  transcripts["Tôi nói"] = "Xin chào";
  transcripts["Họ nói"] = "Hello";
  (speakCode as jest.Mock).mockReset();
});

afterEach(() => {
  global.fetch = originalFetch;
});

const body = (call: number) => JSON.parse((global.fetch as jest.Mock).mock.calls[call][1].body as string);

test("my turn translates vi→en politely and reads it aloud", async () => {
  global.fetch = jest.fn().mockResolvedValue(reply("Hello there")) as unknown as typeof fetch;
  render(<ConversationPage />);
  fireEvent.click(screen.getByRole("button", { name: "Tôi nói" }));

  // Their half shows the latest line in their language; my half keeps the whole log.
  const shown = await screen.findAllByText("Hello there");
  shown.forEach((line) => expect(line).toHaveAttribute("lang", "en"));
  expect(within(screen.getByRole("region", { name: "Phía họ" })).getByText("Hello there")).toBeInTheDocument();
  expect(screen.getAllByText("Xin chào")[0]).toHaveAttribute("lang", "vi");
  expect(body(0)).toEqual({ text: "Xin chào", from: "vi", to: "en", tone: "polite" });
  expect(speakCode).toHaveBeenCalledWith("Hello there", "en-US", expect.anything());
});

test("their turn translates en→vi", async () => {
  global.fetch = jest.fn().mockResolvedValue(reply("Xin chào bạn", "en")) as unknown as typeof fetch;
  render(<ConversationPage />);
  fireEvent.click(screen.getByRole("button", { name: "Họ nói" }));

  await screen.findAllByText("Xin chào bạn");
  expect(body(0)).toEqual({ text: "Hello", from: "en", to: "vi", tone: "polite" });
  expect(speakCode).toHaveBeenCalledWith("Xin chào bạn", "vi-VN", expect.anything());
});

test("buttons are disabled while a turn is processing", async () => {
  let resolve: (value: unknown) => void = () => {};
  global.fetch = jest.fn().mockReturnValue(new Promise((r) => (resolve = r))) as unknown as typeof fetch;
  render(<ConversationPage />);
  fireEvent.click(screen.getByRole("button", { name: "Tôi nói" }));

  expect(screen.getByRole("button", { name: "Tôi nói" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Họ nói" })).toBeDisabled();
  resolve(reply("Hello there"));
  await waitFor(() => expect(screen.getByRole("button", { name: "Họ nói" })).toBeEnabled());
});

test("a failed turn shows an alert and re-enables the buttons", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Không dịch được lúc này. Vui lòng thử lại." }) }) as unknown as typeof fetch;
  render(<ConversationPage />);
  fireEvent.click(screen.getByRole("button", { name: "Tôi nói" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Không dịch được lúc này.");
  expect(screen.getByRole("button", { name: "Tôi nói" })).toBeEnabled();
});

test("empty transcript does not translate", async () => {
  transcripts["Tôi nói"] = " ";
  global.fetch = jest.fn() as unknown as typeof fetch;
  render(<ConversationPage />);
  fireEvent.click(screen.getByRole("button", { name: "Tôi nói" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Không nghe rõ, nói lại nhé.");
  expect(global.fetch).not.toHaveBeenCalled();
});

test("Xoay phía họ rotates their half", () => {
  render(<ConversationPage />);
  const theirs = screen.getByRole("region", { name: "Phía họ" });
  expect(theirs).not.toHaveClass("rotate-180");
  fireEvent.click(screen.getByRole("button", { name: "Xoay phía họ" }));
  expect(theirs).toHaveClass("rotate-180");
  expect(within(theirs).getByRole("button", { name: "Họ nói" })).toBeInTheDocument();
});

test("choosing their language as mine swaps the two", () => {
  render(<ConversationPage />);
  fireEvent.change(screen.getByLabelText("Ngôn ngữ của tôi"), { target: { value: "en" } });
  expect(screen.getByLabelText("Ngôn ngữ của tôi")).toHaveValue("en");
  expect(screen.getByLabelText("Ngôn ngữ của họ")).toHaveValue("vi");
  expect(JSON.parse(localStorage.getItem("conversationPair") ?? "{}")).toEqual({ me: "en", them: "vi" });
});

test("only one side can record at a time", () => {
  render(<ConversationPage />);
  fireEvent.click(screen.getByRole("button", { name: "ghi âm Tôi nói" }));
  expect(screen.getByRole("button", { name: "Họ nói" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Tôi nói" })).toBeEnabled();
});
