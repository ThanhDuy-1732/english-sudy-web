import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReviewPage from "../page";
import { getSessions } from "@/lib/sessions";

jest.mock("@/lib/sync", () => ({ pushWord: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn();
});

function seedReviewWords(words: string[]) {
  localStorage.setItem("learnedWords", JSON.stringify(words.map((word) => ({
    word,
    meaning: word,
    example: `Example ${word}.`,
    topic: "TOEIC",
    learnedAt: "2026-07-16T00:00:00.000Z",
    nextReviewAt: "2026-07-15T00:00:00.000Z",
  }))));
}

test("starts one session and cancels it when leaving mid-review", async () => {
  seedReviewWords(["one"]);
  const { rerender, unmount } = render(<ReviewPage />);
  await waitFor(() => expect(getSessions()).toHaveLength(1));
  rerender(<ReviewPage />);
  expect(getSessions()).toHaveLength(1);
  unmount();
  expect(getSessions()).toEqual([]);
  const nextMount = render(<ReviewPage />);
  expect(getSessions()).toHaveLength(1);
  nextMount.unmount();
});

test("finishes with quality counts and shows a summary after the last card", async () => {
  seedReviewWords(["one", "two"]);
  const { unmount } = render(<ReviewPage />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Xem nghĩa của one" })).toBeInTheDocument());

  fireEvent.click(screen.getByRole("button", { name: "Xem nghĩa của one" }));
  fireEvent.click(screen.getByRole("button", { name: "Quên" }));
  fireEvent.click(screen.getByRole("button", { name: "Xem nghĩa của two" }));
  fireEvent.click(screen.getByRole("button", { name: "Được" }));

  expect(await screen.findByRole("heading", { name: "Ôn tập xong!" })).toBeInTheDocument();
  expect(screen.getByText("Độ chính xác").nextElementSibling).toHaveTextContent("50%");
  expect(screen.getByText("Quên").nextElementSibling).toHaveTextContent("1");
  expect(screen.getByText("Được").nextElementSibling).toHaveTextContent("1");
  expect(getSessions()[0]).toMatchObject({ type: "review", totalItems: 2, correctItems: 1 });
  expect(getSessions()[0].finishedAt).toBeDefined();
  unmount();
  expect(getSessions()).toHaveLength(1);
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
