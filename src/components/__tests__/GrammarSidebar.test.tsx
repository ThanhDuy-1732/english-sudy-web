import { fireEvent, render, screen } from "@testing-library/react";
import GrammarSidebar from "../GrammarSidebar";
import { STATIC_GRAMMAR_TOPICS } from "../../lib/grammar-data";

const mockOnSelect = jest.fn();
const mockOnAddTopic = jest.fn();

const defaultProps = {
  topics: STATIC_GRAMMAR_TOPICS,
  selectedId: STATIC_GRAMMAR_TOPICS[0].id,
  onSelect: mockOnSelect,
  onAddTopic: mockOnAddTopic,
  isAdding: false,
};

describe("GrammarSidebar", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders all topic names", () => {
    render(<GrammarSidebar {...defaultProps} />);
    expect(screen.getByText("Tenses")).toBeInTheDocument();
    expect(screen.getByText("Modal Verbs")).toBeInTheDocument();
    expect(screen.getByText("Conditionals")).toBeInTheDocument();
  });

  it("calls onSelect with topic id when a topic is clicked", () => {
    render(<GrammarSidebar {...defaultProps} />);
    fireEvent.click(screen.getByText("Modal Verbs"));
    expect(mockOnSelect).toHaveBeenCalledWith("modal-verbs");
  });

  it("renders sub-rule count for each topic", () => {
    render(<GrammarSidebar {...defaultProps} />);
    const counts = screen.getAllByText("5");
    expect(counts.length).toBeGreaterThan(0);
  });

  it("calls onAddTopic with trimmed input when form submitted", () => {
    render(<GrammarSidebar {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText(/Nhập chủ đề mới/), {
      target: { value: "  Inversion  " },
    });
    fireEvent.submit(screen.getByRole("form"));
    expect(mockOnAddTopic).toHaveBeenCalledWith("Inversion");
  });

  it("does not call onAddTopic when input is blank", () => {
    render(<GrammarSidebar {...defaultProps} />);
    fireEvent.submit(screen.getByRole("form"));
    expect(mockOnAddTopic).not.toHaveBeenCalled();
  });

  it("disables input and button while isAdding is true", () => {
    render(<GrammarSidebar {...defaultProps} isAdding={true} />);
    expect(screen.getByPlaceholderText(/Nhập chủ đề mới/)).toBeDisabled();
    expect(screen.getByRole("button", { name: /Đang tạo/ })).toBeDisabled();
  });
});
