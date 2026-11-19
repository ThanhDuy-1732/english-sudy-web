import { render, screen } from "@testing-library/react";
import LangText from "../LangText";

test("tags the word with its language and shows the reading", () => {
  render(<LangText lang="ja" word="学生" reading="がくせい" />);
  expect(screen.getByText("学生")).toHaveAttribute("lang", "ja");
  expect(screen.getByText("がくせい")).toBeInTheDocument();
});

test("english uses the English font and no reading line", () => {
  const { container } = render(<LangText lang="en" word="apple" />);
  expect(screen.getByText("apple")).toHaveClass("font-en");
  expect(container.querySelectorAll("span")).toHaveLength(2);
});
