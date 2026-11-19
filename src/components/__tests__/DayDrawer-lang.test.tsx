import { fireEvent, render, screen } from "@testing-library/react";
import DayDrawer from "../DayDrawer";

const w = (lang: "zh" | "ja", example: string) => ({ word: "学生", lang, meaning: "học sinh", example, topic: "TOEIC", learnedAt: "2026-11-01T00:00:00.000Z" });

test("same characters in two languages expand separately", () => {
  render(<DayDrawer date="2026-11-01" words={[w("zh", "我是学生。"), w("ja", "私は学生です。")]} studyMinutes={0} isOpen onClose={() => {}} onNavigate={() => {}} />);
  fireEvent.click(screen.getAllByRole("button", { name: /学生/ })[0]);
  expect(screen.getByText(/我是学生/)).toBeInTheDocument();
  expect(screen.queryByText(/私は学生です/)).toBeNull();
});
