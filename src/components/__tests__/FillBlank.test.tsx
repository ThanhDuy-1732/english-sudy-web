import { fireEvent, render, screen } from "@testing-library/react";
import FillBlank from "../FillBlank";

test("checks a fill-in-the-blank answer", () => {
  render(<FillBlank word="negotiate" sentence="We need to _____ the terms." />);
  fireEvent.change(screen.getByPlaceholderText("____"), { target: { value: "negotiate" } });
  fireEvent.click(screen.getByRole("button", { name: "Kiểm tra" }));
  expect(screen.getByText("Đúng rồi! ✓")).toBeInTheDocument();
});
