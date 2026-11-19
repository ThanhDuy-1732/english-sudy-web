import { act, fireEvent, render, screen } from "@testing-library/react";
import ConceptCard from "../ConceptCard";
import { getLearnedWords } from "@/lib/storage";

jest.mock("@/lib/useApiFetch", () => ({
  useApiFetch: () => ({
    fetchWithProvider: jest.fn(async (_url: string, body: { word: string; lang?: string }) => ({
      ok: true,
      json: async () => (body.lang && body.lang !== "en" ? { sentence: "我有发票。", reading: "wǒ yǒu fāpiào.", translation: "Tôi có hoá đơn." } : { sentence: "Here is the invoice." }),
    })),
  }),
}));

const concept = { conceptId: "c1", meaning: "hoá đơn", words: { en: { word: "invoice" }, zh: { word: "发票", reading: "fāpiào" } } };

beforeEach(() => localStorage.clear());

test("ConceptCard shows every language with its reading", () => {
  render(<ConceptCard concept={concept} langs={["en", "zh"]} topic="TOEIC" />);
  expect(screen.getByText("invoice")).toHaveAttribute("lang", "en");
  expect(screen.getByText("发票")).toHaveAttribute("lang", "zh-CN");
  expect(screen.getByText("fāpiào")).toBeInTheDocument();
});

test("saving stores one word per language with the same conceptId", async () => {
  render(<ConceptCard concept={concept} langs={["en", "zh"]} topic="TOEIC" />);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Xem nghĩa của invoice, 发票" })); });
  expect(await screen.findByText("我有发票。")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Gieo vào vườn" }));
  const saved = getLearnedWords();
  expect(saved.map((w) => `${w.lang}:${w.word}:${w.conceptId}`)).toEqual(["en:invoice:c1", "zh:发票:c1"]);
  expect(saved[1].reading).toBe("fāpiào");
  expect(saved[1].example).toBe("我有发票。");
  expect(screen.getByRole("button", { name: "Đã gieo" })).toBeDisabled();
});

test("flipping back and forth while examples load counts one flip", async () => {
  const onFlip = jest.fn();
  render(<ConceptCard concept={concept} langs={["en", "zh"]} topic="TOEIC" onFlip={onFlip} />);
  fireEvent.click(screen.getByRole("button", { name: "Xem nghĩa của invoice, 发票" }));
  fireEvent.click(screen.getByRole("button", { name: "Lật lại" }));
  fireEvent.click(screen.getByRole("button", { name: "Xem nghĩa của invoice, 发票" }));
  await act(async () => {});
  expect(onFlip).toHaveBeenCalledTimes(1);
});
