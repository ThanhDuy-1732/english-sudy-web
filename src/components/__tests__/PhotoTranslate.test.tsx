import { fireEvent, render, screen } from "@testing-library/react";
import { PhotoTranslate } from "../PhotoTranslate";
import { shrinkImage } from "@/lib/image-resize";

jest.mock("@/lib/image-resize", () => ({ shrinkImage: jest.fn() }));

const mockShrink = shrinkImage as jest.MockedFunction<typeof shrinkImage>;
const originalFetch = global.fetch;

const pick = () =>
  fireEvent.change(screen.getByLabelText("Dịch ảnh"), {
    target: { files: [new File(["x"], "menu.jpg", { type: "image/jpeg" })] },
  });

beforeEach(() => {
  localStorage.clear();
  mockShrink.mockReset().mockResolvedValue("data:image/jpeg;base64,QUJD");
});

afterEach(() => {
  global.fetch = originalFetch;
});

test("a photo becomes translated lines", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ detected: "vi", lines: [{ text: "Phở bò", translation: "牛肉粉", reading: "niúròu fěn" }] }),
  }) as unknown as typeof fetch;
  render(<PhotoTranslate to="zh" />);
  pick();

  expect(await screen.findByText("牛肉粉")).toHaveAttribute("lang", "zh-CN");
  expect(screen.getByText("Phở bò")).toHaveAttribute("lang", "vi");
  expect(screen.getByText("niúròu fěn")).toBeInTheDocument();
  const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string);
  expect(body).toEqual({ image: "data:image/jpeg;base64,QUJD", to: "zh" });
  expect(localStorage.getItem("translationHistory")).toBeNull();
});

test("undecodable image shows an error", async () => {
  global.fetch = jest.fn() as unknown as typeof fetch;
  mockShrink.mockRejectedValue(new Error("Không đọc được ảnh này."));
  render(<PhotoTranslate to="vi" />);
  pick();

  expect(await screen.findByRole("alert")).toHaveTextContent("Không đọc được ảnh này.");
  expect(global.fetch).not.toHaveBeenCalled();
});

test("a server error is shown", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Không thấy chữ trong ảnh." }) }) as unknown as typeof fetch;
  render(<PhotoTranslate to="vi" />);
  pick();

  expect(await screen.findByRole("alert")).toHaveTextContent("Không thấy chữ trong ảnh.");
});
