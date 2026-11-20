import { fireEvent, render, screen } from "@testing-library/react";
import FillBlank from "../FillBlank";

test("checks a fill-in-the-blank answer", () => {
  render(<FillBlank word="negotiate" sentence="We need to _____ the terms." />);
  fireEvent.change(screen.getByPlaceholderText("____"), { target: { value: "negotiate" } });
  fireEvent.click(screen.getByRole("button", { name: "Kiểm tra" }));
  expect(screen.getByText("Đúng rồi! ✓")).toBeInTheDocument();
});

test("FillBlank accepts 学生 typed with a trailing space and 。, and shows reading and translation", () => {
  render(<FillBlank word="学生" lang="zh" sentence="我是_____。" reading="wǒ shì _____." translation="Tôi là học sinh." />);
  expect(screen.getByText("wǒ shì _____.")).toBeInTheDocument();
  expect(screen.getByText("Tôi là học sinh.")).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText("____"), { target: { value: "学生 。" } });
  fireEvent.click(screen.getByRole("button", { name: "Kiểm tra" }));
  expect(screen.getByText("Đúng rồi! ✓")).toBeInTheDocument();
});

test("FillBlank accepts the kana reading of a Japanese word", () => {
  render(<FillBlank word="学生" lang="ja" wordReading="がくせい" sentence="私は_____です。" />);
  fireEvent.change(screen.getByPlaceholderText("____"), { target: { value: "がくせい" } });
  fireEvent.click(screen.getByRole("button", { name: "Kiểm tra" }));
  expect(screen.getByText("Đúng rồi! ✓")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("____")).toHaveAttribute("lang", "ja");
});
