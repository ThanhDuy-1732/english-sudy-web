import { render, screen, fireEvent } from "@testing-library/react";
import PassageReader from "../PassageReader";
import type { ExamItem, ExamQuestion } from "@/lib/exam/types";

const item: ExamItem = {
  id: "item1",
  kind: "TOEIC",
  part: "RC7",
  level: 3,
  passage: "Line one of the passage.\n\nLine two of the passage.",
  questions: [],
  createdAt: new Date().toISOString(),
};

const mcq: ExamQuestion = {
  id: "q1",
  type: "single_passage",
  prompt: "What is the passage about?",
  options: ["Hiring", "Travel", "Billing"],
  answer: "Travel",
  explanation: "The passage mentions a trip.",
  keyVocabulary: ["itinerary", "booking"],
};

const completion: ExamQuestion = {
  id: "q2",
  type: "sentence_completion",
  prompt: "Complete the sentence.",
  answer: "manager",
  explanation: "The manager approved it.",
};

test("renders the passage split by lines", () => {
  render(
    <PassageReader
      item={item}
      question={mcq}
      questionNumber={1}
      totalQuestions={3}
      onAnswer={() => {}}
    />
  );

  expect(screen.getByText("Line one of the passage.")).toBeInTheDocument();
  expect(screen.getByText("Line two of the passage.")).toBeInTheDocument();
  expect(screen.getByText("Đoạn văn")).toBeInTheDocument();
});

test("shows the question header with formatted type", () => {
  render(
    <PassageReader
      item={item}
      question={mcq}
      questionNumber={2}
      totalQuestions={5}
      onAnswer={() => {}}
    />
  );

  expect(screen.getByText("2 / 5")).toBeInTheDocument();
  expect(screen.getByText("Single Passage")).toBeInTheDocument();
  expect(screen.getByText("What is the passage about?")).toBeInTheDocument();
});

test("calls onAnswer when an option is clicked", () => {
  const onAnswer = jest.fn();
  render(
    <PassageReader
      item={item}
      question={mcq}
      questionNumber={1}
      totalQuestions={1}
      onAnswer={onAnswer}
    />
  );

  fireEvent.click(screen.getByText("Travel"));
  expect(onAnswer).toHaveBeenCalledWith("Travel");
});

test("does not call onAnswer after the result is shown", () => {
  const onAnswer = jest.fn();
  render(
    <PassageReader
      item={item}
      question={mcq}
      questionNumber={1}
      totalQuestions={1}
      userAnswer="Hiring"
      showResult
      onAnswer={onAnswer}
    />
  );

  fireEvent.click(screen.getByText("Travel"));
  expect(onAnswer).not.toHaveBeenCalled();
});

test("marks the correct answer and the wrong selection in the result panel", () => {
  render(
    <PassageReader
      item={item}
      question={mcq}
      questionNumber={1}
      totalQuestions={1}
      userAnswer="Hiring"
      showResult
      onAnswer={() => {}}
    />
  );

  expect(screen.getByText("Travel")).toHaveClass("correct");
  expect(screen.getByText("Hiring")).toHaveClass("wrong");
  expect(screen.getByText("Đáp án: Travel")).toBeInTheDocument();
  expect(screen.getByText("The passage mentions a trip.")).toBeInTheDocument();
  expect(screen.getByText("Từ vựng: itinerary, booking")).toBeInTheDocument();
});

test("renders a text input for completion questions and reports typed answers", () => {
  const onAnswer = jest.fn();
  render(
    <PassageReader
      item={{ ...item, passage: "Complete this." }}
      question={completion}
      questionNumber={1}
      totalQuestions={1}
      onAnswer={onAnswer}
    />
  );

  const input = screen.getByPlaceholderText("Nhập đáp án…");
  fireEvent.change(input, { target: { value: "manager" } });
  expect(onAnswer).toHaveBeenCalledWith("manager");
});

test("disables the completion input when the result is shown", () => {
  render(
    <PassageReader
      item={item}
      question={completion}
      questionNumber={1}
      totalQuestions={1}
      userAnswer="manager"
      showResult
      onAnswer={() => {}}
    />
  );

  expect(screen.getByPlaceholderText("Nhập đáp án…")).toBeDisabled();
  expect(screen.getByText("Đáp án: manager")).toBeInTheDocument();
});

test("renders without a passage", () => {
  render(
    <PassageReader
      item={{ ...item, passage: undefined }}
      question={mcq}
      questionNumber={1}
      totalQuestions={1}
      onAnswer={() => {}}
    />
  );

  expect(screen.getByText("Đoạn văn")).toBeInTheDocument();
});
