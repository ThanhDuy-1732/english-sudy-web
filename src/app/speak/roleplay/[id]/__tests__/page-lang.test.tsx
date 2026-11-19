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
