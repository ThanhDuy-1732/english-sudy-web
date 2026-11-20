import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Flashcard from "../Flashcard";

global.fetch = jest.fn().mockImplementation((input: string) =>
  Promise.resolve({
    ok: true,
    headers: { get: () => null },
    json: async () =>
      input === "/api/generate-synonyms"
        ? { synonyms: [], antonyms: [] }
        : { sentence: "I greet my neighbors." },
  }),
);

jest.mock("@/lib/storage", () => ({
  saveLearnedWord: jest.fn().mockReturnValue(true),
  reviewWord: jest.fn(),
  getLearnedWords: jest.fn().mockReturnValue([
    {
      word: "greet",
      meaning: "chào hỏi",
      example: "I greet my neighbors.",
      topic: "Daily Communication",
      learnedAt: new Date().toISOString(),
      nextReviewAt: new Date(Date.now() + 86400000).toISOString(),
      reviewInterval: 1,
      mastery: 0,
    },
  ]),
}));

jest.mock("@/lib/useVoiceSettings", () => ({
  useVoiceSettings: () => ({
    settings: { voiceURI: null, rate: 0.9, pitch: 1.0, volume: 1.0 },
    update: jest.fn(),
  }),
}));

import { saveLearnedWord, getLearnedWords } from "@/lib/storage";

beforeEach(() => {
  jest.clearAllMocks();
  (saveLearnedWord as jest.Mock).mockReturnValue(true);
  (getLearnedWords as jest.Mock).mockReturnValue([
    {
      word: "greet",
      meaning: "chào hỏi",
      example: "I greet my neighbors.",
      topic: "Daily Communication",
      learnedAt: new Date().toISOString(),
      nextReviewAt: new Date(Date.now() + 86400000).toISOString(),
      reviewInterval: 1,
      mastery: 0,
    },
  ]);
});

test("shows word on front face initially", () => {
  render(<Flashcard word="greet" meaning="chào hỏi" topic="Daily Communication" />);
  expect(screen.getByRole("button", { name: "Xem nghĩa của greet" })).toHaveTextContent("greet");
});

test("shows meaning and example after clicking", async () => {
  render(<Flashcard word="greet" meaning="chào hỏi" topic="Daily Communication" />);
  fireEvent.click(screen.getByRole("button", { name: "Xem nghĩa của greet" }));
  await waitFor(() => expect(screen.getByText("I greet my neighbors.")).toBeInTheDocument());
  expect(screen.getByText("chào hỏi")).toBeInTheDocument();
});

test("uses a saved example and synonyms without requesting the network", async () => {
  render(
    <Flashcard
      word="greet"
      meaning="chào hỏi"
      topic="Daily Communication"
      initialExample="I greet my neighbors."
      initialSynonymData={{ synonyms: ["welcome", "hello"], antonyms: ["ignore"] }}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Xem nghĩa của greet" }));

  await waitFor(() => expect(screen.getByText("I greet my neighbors.")).toBeInTheDocument());
  expect(global.fetch).not.toHaveBeenCalled();
});

test("calls saveLearnedWord when Đã học is clicked", async () => {
  render(<Flashcard word="greet" meaning="chào hỏi" topic="Daily Communication" />);
  fireEvent.click(screen.getByRole("button", { name: "Xem nghĩa của greet" }));
  await waitFor(() => screen.getByText("Gieo vào vườn"));
  fireEvent.click(screen.getByText("Gieo vào vườn"));
  expect(saveLearnedWord).toHaveBeenCalledWith(
    expect.objectContaining({
      word: "greet",
      meaning: "chào hỏi",
      topic: "Daily Communication",
    }),
  );
});

test("clicking card while loading does NOT toggle back to front", async () => {
  // Delay the fetch so we can click during loading
  let resolveFetch!: (value: { ok: boolean; headers: { get: (name: string) => string | null }; json: () => Promise<{ sentence: string }> }) => void;
  (global.fetch as jest.Mock).mockReturnValueOnce(
    new Promise((resolve) => {
      resolveFetch = resolve;
    }),
  );

  render(<Flashcard word="greet" meaning="chào hỏi" topic="Daily Communication" />);
  // First click starts the fetch (loading begins)
  fireEvent.click(screen.getByRole("button", { name: "Xem nghĩa của greet" }));
  // Second click while loading should be a no-op (loading guard)
  fireEvent.click(screen.getByRole("button", { name: "Xem nghĩa của greet" }));

  // Resolve the fetch
  resolveFetch({ ok: true, headers: { get: () => null }, json: async () => ({ sentence: "I greet my neighbors." }) });

  // Card should flip to showing the meaning after fetch resolves
  await waitFor(() => expect(screen.getByText("chào hỏi")).toBeInTheDocument());
});

test("setSaved stays false when saveLearnedWord returns false (duplicate)", async () => {
  (saveLearnedWord as jest.Mock).mockReturnValue(false);

  render(<Flashcard word="greet" meaning="chào hỏi" topic="Daily Communication" />);
  fireEvent.click(screen.getByRole("button", { name: "Xem nghĩa của greet" }));
  await waitFor(() => screen.getByText("Gieo vào vườn"));
  fireEvent.click(screen.getByText("Gieo vào vườn"));

  // Button label should NOT change to "Đã gieo"
  expect(screen.getByText("Gieo vào vườn")).toBeInTheDocument();
  expect(screen.queryByText("Đã gieo")).not.toBeInTheDocument();
});

test("keeps flip and save actions as separate accessible buttons", async () => {
  render(<Flashcard word="greet" meaning="chào hỏi" topic="Daily Communication" />);

  fireEvent.click(screen.getByRole("button", { name: "Xem nghĩa của greet" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Gieo vào vườn" })).toBeInTheDocument(),
  );

  expect(screen.getByRole("button", { name: "Lật lại" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Lật lại" }));
  expect(screen.getByRole("button", { name: "Xem nghĩa của greet" })).toBeInTheDocument();
});

test("review shortcuts: Space flips the active card and 3 grades it 'Được'", async () => {
  const onReviewed = jest.fn();
  render(<Flashcard word="greet" meaning="chào hỏi" topic="TOEIC" initialExample="I greet them." initialSynonymData={{ synonyms: [], antonyms: [] }} isReviewMode onReviewed={onReviewed} shortcuts />);
  fireEvent.keyDown(window, { key: "3" });
  expect(onReviewed).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { key: " " });
  await waitFor(() => expect(screen.getByRole("button", { name: "Lật lại" })).toBeInTheDocument());
  fireEvent.keyDown(window, { key: "3" });
  expect(onReviewed).toHaveBeenCalledWith(4);
});

describe("languages", () => {
  const zhWord = { word: "学生", meaning: "học sinh", example: "", topic: "TOEIC", learnedAt: "2026-11-01T00:00:00.000Z", lang: "zh" as const, reading: "xuéshēng", conceptId: "c1" };

  test("grading a zh card reviews the zh word", async () => {
    const { reviewWord } = jest.requireMock("@/lib/storage") as { reviewWord: jest.Mock };
    reviewWord.mockClear();
    render(<Flashcard word="学生" meaning="học sinh" topic="TOEIC" lang="zh" reading="xuéshēng" initialExample="我是学生。" initialSynonymData={{ synonyms: [], antonyms: [] }} isReviewMode learned={zhWord} />);
    fireEvent.click(screen.getByRole("button", { name: "Xem nghĩa của 学生" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Lật lại" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /^Được/ }));
    expect(reviewWord).toHaveBeenCalledWith("学生", 4, undefined, "zh");
  });

  test("non-English card shows the typing modes and its reading", async () => {
    render(<Flashcard word="学生" meaning="học sinh" topic="TOEIC" lang="zh" reading="xuéshēng" initialExample="我是学生。" initialSynonymData={{ synonyms: [], antonyms: [] }} />);
    expect(screen.getAllByText("学生")[0]).toHaveAttribute("lang", "zh-CN");
    expect(screen.getAllByText("xuéshēng").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Xem nghĩa của 学生" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Lật lại" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Viết câu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Điền từ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nghe" })).toBeInTheDocument();
  });

  test("Chinese synonyms carry the language and the CJK font", async () => {
    render(<Flashcard word="学生" meaning="học sinh" topic="TOEIC" lang="zh" initialExample="我是学生。" initialSynonymData={{ synonyms: ["学员"], antonyms: ["老师"] }} />);
    fireEvent.click(screen.getByRole("button", { name: "Xem nghĩa của 学生" }));
    const synonym = await screen.findByText("学员");
    expect(synonym).toHaveAttribute("lang", "zh-CN");
    expect(synonym).not.toHaveClass("font-en");
    expect(screen.getByText("老师")).toHaveAttribute("lang", "zh-CN");
  });

  test("shows sibling words of the same meaning", async () => {
    (getLearnedWords as jest.Mock).mockReturnValueOnce([zhWord, { ...zhWord, word: "学生", lang: "ja", reading: "がくせい" }, { ...zhWord, word: "student", lang: "en", reading: undefined }]);
    render(<Flashcard word="学生" meaning="học sinh" topic="TOEIC" lang="zh" initialExample="我是学生。" initialSynonymData={{ synonyms: [], antonyms: [] }} isReviewMode learned={zhWord} />);
    fireEvent.click(screen.getByRole("button", { name: "Xem nghĩa của 学生" }));
    await waitFor(() => expect(screen.getByText(/Cũng là/)).toBeInTheDocument());
    expect(screen.getByText(/Cũng là/).textContent).toContain("student");
    expect(screen.getByText(/Cũng là/).textContent).toContain("日");
  });

  test("english request bodies carry no lang", async () => {
    (global.fetch as jest.Mock).mockClear();
    render(<Flashcard word="greet" meaning="chào hỏi" topic="TOEIC" />);
    fireEvent.click(screen.getByRole("button", { name: "Xem nghĩa của greet" }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const bodies = (global.fetch as jest.Mock).mock.calls.map((call) => String(call[1]?.body ?? ""));
    expect(bodies.some((body) => body.includes('"lang"'))).toBe(false);
  });
});
