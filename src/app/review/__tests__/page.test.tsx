import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReviewPage from "../page";

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn();
});

test("flips a saved review card offline without requesting generated content", async () => {
  localStorage.setItem(
    "learnedWords",
    JSON.stringify([
      {
        word: "negotiate",
        meaning: "đàm phán",
        example: "We need to negotiate.",
        topic: "TOEIC",
        learnedAt: "2026-07-16T00:00:00.000Z",
        nextReviewAt: "2026-07-15T00:00:00.000Z",
        synonyms: ["bargain"],
        antonyms: ["refuse"],
      },
    ]),
  );

  render(<ReviewPage />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Xem nghĩa của negotiate" })).toBeInTheDocument());

  fireEvent.click(screen.getByRole("button", { name: "Xem nghĩa của negotiate" }));

  expect(await screen.findByText("We need to negotiate.")).toBeInTheDocument();
  expect(screen.getByText("bargain")).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});
