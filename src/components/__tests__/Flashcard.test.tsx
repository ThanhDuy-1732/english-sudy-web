import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Flashcard from "../Flashcard";

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ sentence: "I greet my neighbors." }),
});

jest.mock("@/lib/storage", () => ({
  saveLearnedWord: jest.fn().mockReturnValue(true),
}));

import { saveLearnedWord } from "@/lib/storage";

beforeEach(() => {
  jest.clearAllMocks();
  (saveLearnedWord as jest.Mock).mockReturnValue(true);
});

test("shows word on front face initially", () => {
  render(<Flashcard word="greet" meaning="chào hỏi" topic="Daily Communication" />);
  expect(screen.getByText("greet")).toBeInTheDocument();
});

test("shows meaning and example after clicking", async () => {
  render(<Flashcard word="greet" meaning="chào hỏi" topic="Daily Communication" />);
  fireEvent.click(screen.getByRole("button", { name: /greet/i }));
  await waitFor(() => expect(screen.getByText("chào hỏi")).toBeInTheDocument());
  expect(screen.getByText("I greet my neighbors.")).toBeInTheDocument();
});

test("calls saveLearnedWord when Đã học is clicked", async () => {
  render(<Flashcard word="greet" meaning="chào hỏi" topic="Daily Communication" />);
  fireEvent.click(screen.getByRole("button", { name: /greet/i }));
  await waitFor(() => screen.getByText("Đã học ✓"));
  fireEvent.click(screen.getByText("Đã học ✓"));
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
  let resolveFetch!: (value: { ok: boolean; json: () => Promise<{ sentence: string }> }) => void;
  (global.fetch as jest.Mock).mockReturnValueOnce(
    new Promise((resolve) => {
      resolveFetch = resolve;
    }),
  );

  render(<Flashcard word="greet" meaning="chào hỏi" topic="Daily Communication" />);
  // First click starts the fetch (loading begins)
  fireEvent.click(screen.getByRole("button", { name: /greet/i }));
  // Second click while loading should be a no-op (loading guard)
  fireEvent.click(screen.getByRole("button", { name: /greet/i }));

  // Resolve the fetch
  resolveFetch({ ok: true, json: async () => ({ sentence: "I greet my neighbors." }) });

  // Card should flip to showing the meaning after fetch resolves
  await waitFor(() => expect(screen.getByText("chào hỏi")).toBeInTheDocument());
});

test("setSaved stays false when saveLearnedWord returns false (duplicate)", async () => {
  (saveLearnedWord as jest.Mock).mockReturnValue(false);

  render(<Flashcard word="greet" meaning="chào hỏi" topic="Daily Communication" />);
  fireEvent.click(screen.getByRole("button", { name: /greet/i }));
  await waitFor(() => screen.getByText("Đã học ✓"));
  fireEvent.click(screen.getByText("Đã học ✓"));

  // Button label should NOT change to "Đã lưu ✓"
  expect(screen.getByText("Đã học ✓")).toBeInTheDocument();
  expect(screen.queryByText("Đã lưu ✓")).not.toBeInTheDocument();
});
