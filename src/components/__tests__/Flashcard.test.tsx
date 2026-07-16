import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Flashcard from "../Flashcard";

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ sentence: "I greet my neighbors." }),
});

jest.mock("@/lib/storage", () => ({
  saveLearnedWord: jest.fn(),
}));

import { saveLearnedWord } from "@/lib/storage";

beforeEach(() => {
  jest.clearAllMocks();
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
