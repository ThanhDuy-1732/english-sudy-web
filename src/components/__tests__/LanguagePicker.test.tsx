import { act, fireEvent, render, screen } from "@testing-library/react";
import LanguagePicker from "../LanguagePicker";

beforeEach(() => localStorage.clear());

test("toggling adds a language", async () => {
  render(<LanguagePicker />);
  await act(async () => {});
  fireEvent.click(screen.getByRole("checkbox", { name: /中文/ }));
  expect(JSON.parse(localStorage.getItem("learningLanguages")!)).toEqual(["en", "zh"]);
  expect(screen.getByLabelText("Ngôn ngữ học: Tiếng Anh, Tiếng Trung")).toBeInTheDocument();
});

test("last language cannot be unchecked", async () => {
  render(<LanguagePicker />);
  await act(async () => {});
  const english = screen.getByRole("checkbox", { name: /English/ });
  expect(english).toBeChecked();
  expect(english).toBeDisabled();
});

test("more than two languages: the pill shows two codes and a count, so it fits the phone top bar", async () => {
  localStorage.setItem("learningLanguages", JSON.stringify(["en", "zh", "ja", "ko"]));
  render(<LanguagePicker />);
  await act(async () => {});
  const pill = screen.getByLabelText("Ngôn ngữ học: Tiếng Anh, Tiếng Trung, Tiếng Nhật, Tiếng Hàn");
  expect(pill.textContent).toBe("EN · 中 +2");
});
