import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import VocabContextPage from "../page";

jest.mock("@/lib/useApiFetch", () => ({ useApiFetch: () => ({ fetchWithProvider: jest.fn() }) }));

const w = (word: string, lang?: string) => ({ word, ...(lang ? { lang } : {}), meaning: "nghĩa", example: "", topic: "TOEIC", learnedAt: "2026-11-01T00:00:00.000Z" });

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ text: "**学生**です。" }) });
});

test("english only: no language selector", async () => {
  localStorage.setItem("learnedWords", JSON.stringify([w("apple"), w("pear")]));
  render(<VocabContextPage />);
  await waitFor(() => expect(screen.getByRole("button", { name: "apple" })).toBeInTheDocument());
  expect(screen.queryByRole("radiogroup", { name: "Ngôn ngữ" })).toBeNull();
});

test("languages without saved words are not offered", async () => {
  localStorage.setItem("learningLanguages", JSON.stringify(["en", "zh", "ko"]));
  localStorage.setItem("learnedWords", JSON.stringify([w("apple"), w("学生", "zh")]));
  render(<VocabContextPage />);
  await screen.findByRole("radio", { name: "中文" });
  expect(screen.queryByRole("radio", { name: "한국어" })).toBeNull();
});

test("choosing 日本語 lists only Japanese words and sends lang=ja; 学生 shows once per language", async () => {
  const errors = jest.spyOn(console, "error").mockImplementation(() => {});
  localStorage.setItem("learningLanguages", JSON.stringify(["en", "zh", "ja"]));
  localStorage.setItem("learnedWords", JSON.stringify([w("apple"), w("学生", "zh"), w("学生", "ja"), w("水", "ja")]));
  render(<VocabContextPage />);
  fireEvent.click(await screen.findByRole("radio", { name: "中文" }));
  expect(screen.getAllByRole("button", { name: "学生" })).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "水" })).toBeNull();
  fireEvent.click(screen.getByRole("radio", { name: "日本語" }));
  expect(screen.getAllByRole("button", { name: "学生" })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "学生" }));
  fireEvent.click(screen.getByRole("button", { name: "水" }));
  fireEvent.click(screen.getByRole("button", { name: /Tạo nội dung/ }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).toMatchObject({ lang: "ja", words: ["学生", "水"] });
  expect(errors.mock.calls.some((call) => String(call[0]).includes("same key"))).toBe(false);
  errors.mockRestore();
});
