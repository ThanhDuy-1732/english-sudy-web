import { render, screen } from "@testing-library/react";
import GrammarContent from "../GrammarContent";
import { STATIC_GRAMMAR_TOPICS } from "../../lib/grammar-data";

const tensesTopic = STATIC_GRAMMAR_TOPICS[0];

describe("GrammarContent", () => {
  it("renders the topic name as heading", () => {
    render(<GrammarContent topic={tensesTopic} />);
    expect(screen.getByRole("heading", { name: "Tenses" })).toBeInTheDocument();
  });

  it("renders each sub-rule name", () => {
    render(<GrammarContent topic={tensesTopic} />);
    expect(screen.getByText("Present Simple")).toBeInTheDocument();
    expect(screen.getByText("Past Simple")).toBeInTheDocument();
  });

  it("renders the formula for each sub-rule", () => {
    render(<GrammarContent topic={tensesTopic} />);
    expect(
      screen.getByText(/S \+ V\(s\/es\)\s+\|\s+S \+ do\/does \+ not \+ V/)
    ).toBeInTheDocument();
  });

  it("renders static example sentences", () => {
    render(<GrammarContent topic={tensesTopic} />);
    expect(screen.getByText("She works at a hospital.")).toBeInTheDocument();
  });

  it("renders Thêm ví dụ buttons for each sub-rule", () => {
    render(<GrammarContent topic={tensesTopic} />);
    const buttons = screen.getAllByRole("button", { name: /Thêm ví dụ/ });
    expect(buttons).toHaveLength(tensesTopic.rules.length);
  });

  it("renders Luyện tập buttons for each sub-rule", () => {
    render(<GrammarContent topic={tensesTopic} />);
    const buttons = screen.getAllByRole("button", { name: /Luyện tập/ });
    expect(buttons).toHaveLength(tensesTopic.rules.length);
  });
});
