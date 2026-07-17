import { fireEvent, render, screen } from "@testing-library/react";
import ReadingMode from "../ReadingMode";

test("highlights words and scores submitted answers", () => {
  render(<ReadingMode passage="We negotiate terms." questions={[{ question: "What do we do?", options: ["A. Negotiate", "B. Sleep", "C. Run"], answer: "A" }]} highlightWords={["negotiate"]} onClose={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "A. Negotiate" }));
  fireEvent.click(screen.getByRole("button", { name: "Nộp bài" }));
  expect(screen.getByText("1/1")).toBeInTheDocument();
  expect(screen.getByText("negotiate")).toBeInTheDocument();
});
