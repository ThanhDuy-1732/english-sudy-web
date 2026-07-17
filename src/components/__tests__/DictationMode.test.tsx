import { fireEvent, render, screen } from "@testing-library/react";
import DictationMode from "../DictationMode";

test("shows dictation comparison after checking", () => {
  render(<DictationMode sentence="We negotiate terms." />);
  fireEvent.change(screen.getByPlaceholderText("Gõ lại câu bạn vừa nghe..."), { target: { value: "We negotiate terms extra." } });
  fireEvent.click(screen.getByRole("button", { name: "Kiểm tra" }));
  expect(screen.getByText("Câu đúng: We negotiate terms.")).toBeInTheDocument();
  expect(screen.getByText("extra.")).toHaveClass("text-red-600");
});
