import { fireEvent, render, screen } from "@testing-library/react";
import GrammarExercise from "../GrammarExercise";

const fillExercise = {
  type: "fill" as const,
  question: "She ___ to school every day.",
  answer: "goes",
};

const mcqExercise = {
  type: "mcq" as const,
  question: "Choose the correct form:",
  options: ["go", "goes", "went", "going"],
  answer: "goes",
};

describe("GrammarExercise - fill-in-the-blank", () => {
  it("renders the question text", () => {
    render(<GrammarExercise exercise={fillExercise} />);
    expect(screen.getByText(/She ___ to school every day/)).toBeInTheDocument();
  });

  it("renders a text input and Kiểm tra button", () => {
    render(<GrammarExercise exercise={fillExercise} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kiểm tra" })).toBeInTheDocument();
  });

  it("shows Đúng feedback for correct answer", () => {
    render(<GrammarExercise exercise={fillExercise} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "goes" } });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra" }));
    expect(screen.getByText(/Đúng/)).toBeInTheDocument();
  });

  it("shows Sai feedback and correct answer for wrong input", () => {
    render(<GrammarExercise exercise={fillExercise} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "go" } });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra" }));
    expect(screen.getByText(/Sai/)).toBeInTheDocument();
    expect(screen.getByText("goes")).toBeInTheDocument();
  });

  it("answer check is case-insensitive", () => {
    render(<GrammarExercise exercise={fillExercise} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "GOES" } });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra" }));
    expect(screen.getByText(/Đúng/)).toBeInTheDocument();
  });
});

describe("GrammarExercise - MCQ", () => {
  it("renders all options as buttons", () => {
    render(<GrammarExercise exercise={mcqExercise} />);
    expect(screen.getByText("go")).toBeInTheDocument();
    expect(screen.getByText("goes")).toBeInTheDocument();
    expect(screen.getByText("went")).toBeInTheDocument();
    expect(screen.getByText("going")).toBeInTheDocument();
  });

  it("shows Đúng feedback when correct option clicked", () => {
    render(<GrammarExercise exercise={mcqExercise} />);
    fireEvent.click(screen.getByText("goes"));
    expect(screen.getByText(/Đúng/)).toBeInTheDocument();
  });

  it("shows Sai feedback when wrong option clicked", () => {
    render(<GrammarExercise exercise={mcqExercise} />);
    fireEvent.click(screen.getByText("go"));
    expect(screen.getByText(/Sai/)).toBeInTheDocument();
  });
});
