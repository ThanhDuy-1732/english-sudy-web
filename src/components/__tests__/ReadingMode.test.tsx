import { fireEvent, render, screen } from "@testing-library/react";
import ReadingMode from "../ReadingMode";

test("highlights words and scores submitted answers", () => {
  render(<ReadingMode passage="We negotiate terms." questions={[{ question: "What do we do?", options: ["A. Negotiate", "B. Sleep", "C. Run"], answer: "A" }]} highlightWords={["negotiate"]} onClose={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "A. Negotiate" }));
  fireEvent.click(screen.getByRole("button", { name: "Nộp bài" }));
  expect(screen.getByText("1/1")).toBeInTheDocument();
  expect(screen.getByText("negotiate")).toBeInTheDocument();
});

test("Chinese questions and options carry the language", () => {
  render(<ReadingMode lang="zh" passage="我有发票。" questions={[{ question: "他有什么？", options: ["A. 发票", "B. 书", "C. 笔"], answer: "A" }]} highlightWords={["发票"]} onClose={jest.fn()} />);
  expect(screen.getByText(/他有什么？/)).toHaveAttribute("lang", "zh-CN");
  expect(screen.getByRole("button", { name: "A. 发票" })).toHaveAttribute("lang", "zh-CN");
});
