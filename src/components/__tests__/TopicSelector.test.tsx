import { fireEvent, render, screen } from "@testing-library/react";
import TopicSelector from "../TopicSelector";

test("renders both topic buttons", () => {
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
  expect(active.className).toContain("bg-blue-600");
});
