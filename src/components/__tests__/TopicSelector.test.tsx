import { fireEvent, render, screen } from "@testing-library/react";
import TopicSelector from "../TopicSelector";

beforeEach(() => localStorage.clear());

test("renders both built-in topic buttons", () => {
  render(<TopicSelector value="Daily Communication" onChange={jest.fn()} />);
  expect(screen.getByText("Daily Communication")).toBeInTheDocument();
  expect(screen.getByText("TOEIC")).toBeInTheDocument();
});

test("calls onChange with selected topic", () => {
  const onChange = jest.fn();
  render(<TopicSelector value="Daily Communication" onChange={onChange} />);
  fireEvent.click(screen.getByText("TOEIC"));
  expect(onChange).toHaveBeenCalledWith("TOEIC");
});

test("active topic button has different style", () => {
  render(<TopicSelector value="TOEIC" onChange={jest.fn()} />);
  const active = screen.getByText("TOEIC");
  expect(active.className).toContain("bg-[#7f56d9]");
  expect(active).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("Daily Communication")).toHaveAttribute("aria-pressed", "false");
});

test("built-in topics do not have a delete button", () => {
  render(<TopicSelector value="Daily Communication" onChange={jest.fn()} />);
  const deleteButtons = screen.queryAllByRole("button", { name: /verwijder|xóa|delete|×/i });
  expect(deleteButtons).toHaveLength(0);
});

test("custom topic shows a delete button", () => {
  localStorage.setItem("customTopics", JSON.stringify(["Cooking"]));
  render(<TopicSelector value="Daily Communication" onChange={jest.fn()} />);
  expect(screen.getByText("Cooking")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Xóa chủ đề Cooking" })).toBeInTheDocument();
});

test("clicking delete removes custom topic from UI", () => {
  localStorage.setItem("customTopics", JSON.stringify(["Cooking"]));
  render(<TopicSelector value="Daily Communication" onChange={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Xóa chủ đề Cooking" }));
  expect(screen.queryByText("Cooking")).not.toBeInTheDocument();
});

test("deleting the currently selected custom topic resets to first built-in topic", () => {
  localStorage.setItem("customTopics", JSON.stringify(["Cooking"]));
  const onChange = jest.fn();
  render(<TopicSelector value="Cooking" onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Xóa chủ đề Cooking" }));
  expect(onChange).toHaveBeenCalledWith("Daily Communication");
});
