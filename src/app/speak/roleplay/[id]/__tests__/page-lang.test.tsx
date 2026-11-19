import { act, fireEvent, render, screen } from "@testing-library/react";
import RoleplayPage from "../page";

jest.mock("next/navigation", () => ({ useParams: () => ({ id: "hotel" }), useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/lib/speech/speaking-storage", () => ({ saveSpeaking: jest.fn() }));

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ reply: "好的，请稍等。", reading: "Hǎo de, qǐng shāo děng.", correction: null, goalAchieved: false, suggestedReplies: [] }) });
});

test("english only: no language selector", () => {
  render(<RoleplayPage />);
  expect(screen.queryByRole("radiogroup", { name: "Ngôn ngữ" })).toBeNull();
});

test("language locks after the first message; the reply shows its reading", async () => {
  localStorage.setItem("learningLanguages", JSON.stringify(["en", "zh"]));
  render(<RoleplayPage />);
  fireEvent.click(await screen.findByRole("radio", { name: "中文" }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "你好" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Gửi" })); });
  expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).lang).toBe("zh");
  expect(await screen.findByText("Hǎo de, qǐng shāo děng.")).toBeInTheDocument();
  expect(screen.queryByRole("radiogroup", { name: "Ngôn ngữ" })).toBeNull();
});

test("the language stays fixed after the first message even if learning languages change", async () => {
  localStorage.setItem("learningLanguages", JSON.stringify(["zh", "ko"]));
  render(<RoleplayPage />);
  fireEvent.click(await screen.findByRole("radio", { name: "한국어" }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "안녕하세요" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Gửi" })); });
  await act(async () => {
    localStorage.setItem("learningLanguages", JSON.stringify(["en", "zh"]));
    window.dispatchEvent(new Event("learning-languages"));
  });
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "감사합니다" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Gửi" })); });
  const bodies = (global.fetch as jest.Mock).mock.calls.map((c) => JSON.parse(c[1].body).lang);
  expect(bodies).toEqual(["ko", "ko"]);
});
