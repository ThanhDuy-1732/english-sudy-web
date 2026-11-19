import { render, screen, waitFor } from "@testing-library/react";
import VocabContextPage from "../page";

jest.mock("@/lib/useApiFetch", () => ({ useApiFetch: () => ({ fetchWithProvider: jest.fn() }) }));

test("a spelling saved in two languages is listed once", async () => {
  const errors = jest.spyOn(console, "error").mockImplementation(() => {});
  localStorage.setItem("learnedWords", JSON.stringify([
    { word: "学生", lang: "zh", meaning: "học sinh", example: "", topic: "TOEIC", learnedAt: "2026-11-01T00:00:00.000Z" },
    { word: "学生", lang: "ja", meaning: "học sinh", example: "", topic: "TOEIC", learnedAt: "2026-11-01T00:00:00.000Z" },
  ]));
  render(<VocabContextPage />);
  await waitFor(() => expect(screen.getAllByRole("button", { name: "学生" })).toHaveLength(1));
  expect(errors.mock.calls.some((call) => String(call[0]).includes("same key"))).toBe(false);
  errors.mockRestore();
});
