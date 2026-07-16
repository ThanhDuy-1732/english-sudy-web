import { render, screen } from "@testing-library/react";
import FlashcardGrid from "../FlashcardGrid";

jest.mock("../Flashcard", () =>
  function MockFlashcard({ word }: { word: string }) {
    return <div data-testid="flashcard">{word}</div>;
  },
);

const words = [
  { word: "negotiate", meaning: "đàm phán" },
  { word: "analyze", meaning: "phân tích" },
];

test("renders one Flashcard per word", () => {
  render(<FlashcardGrid words={words} topic="TOEIC" />);
  expect(screen.getAllByTestId("flashcard")).toHaveLength(2);
});

test("passes word text to each Flashcard", () => {
  render(<FlashcardGrid words={words} topic="TOEIC" />);
  expect(screen.getByText("negotiate")).toBeInTheDocument();
  expect(screen.getByText("analyze")).toBeInTheDocument();
});
