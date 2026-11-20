import { fireEvent, render, screen } from "@testing-library/react";
import TranslatePage from "../page";

const originalFetch = global.fetch;

const TRANSLATION = {
  detected: "zh",
  vietnamese: "Xin chào, tôi muốn đặt bàn cho 2 người",
  results: [
    { tone: "casual", text: "你好，我想订两个人的位子。", reading: "nǐ hǎo", note: "Thân mật." },
    { tone: "polite", text: "您好，我想订两个人的位子。", reading: "nín hǎo", note: "Lịch sự." },
    { tone: "formal", text: "您好，我想预订两位的餐位。", reading: "nín hǎo", note: "Trang trọng." },
  ],
};

function mockFetch(response: unknown, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status === 200,
    status,
    json: async () => response,
  }) as unknown as typeof fetch;
}

const type = (value: string) => {
  const area = screen.getByLabelText("Nội dung cần dịch");
  fireEvent.change(area, { target: { value } });
};

beforeEach(() => localStorage.clear());

afterEach(() => {
  global.fetch = originalFetch;
});

test("dịch và hiện ba thẻ sắc thái", async () => {
  mockFetch(TRANSLATION);
  localStorage.setItem("translatePair", JSON.stringify({ from: "vi", to: "zh" }));

  render(<TranslatePage />);
  type("Xin chào, tôi muốn đặt bàn cho 2 người");
  fireEvent.click(screen.getByRole("button", { name: "Dịch" }));

  expect(await screen.findByText("Thân mật")).toBeInTheDocument();
  expect(screen.getByText("Lịch sự")).toBeInTheDocument();
  expect(screen.getByText("Trang trọng")).toBeInTheDocument();
  expect(screen.getByText("你好，我想订两个人的位子。")).toHaveAttribute("lang", "zh-CN");
  expect(screen.queryByText("Đã nhận:")).not.toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(
    "/api/translate",
    expect.objectContaining({ method: "POST" })
  );
  const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string);
  expect(body).toEqual({ text: "Xin chào, tôi muốn đặt bàn cho 2 người", from: "vi", to: "zh" });
});

test("bộ đếm chặn trên 1.000 ký tự", () => {
  render(<TranslatePage />);
  type("a".repeat(1001));
  expect(screen.getByText("1001/1.000")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Dịch" })).toBeDisabled();
});

test("nút đảo chiều đổi hai ngôn ngữ", () => {
  localStorage.setItem("translatePair", JSON.stringify({ from: "vi", to: "zh" }));
  render(<TranslatePage />);
  expect(screen.getByLabelText("Ngôn ngữ nguồn")).toHaveValue("vi");
  expect(screen.getByLabelText("Ngôn ngữ đích")).toHaveValue("zh");

  fireEvent.click(screen.getByRole("button", { name: "Đảo chiều" }));
  expect(screen.getByLabelText("Ngôn ngữ nguồn")).toHaveValue("zh");
  expect(screen.getByLabelText("Ngôn ngữ đích")).toHaveValue("vi");
});

test("auto hiện ngôn ngữ đã nhận diện", async () => {
  mockFetch({ ...TRANSLATION, detected: "ko" });

  render(<TranslatePage />);
  fireEvent.change(screen.getByLabelText("Ngôn ngữ nguồn"), { target: { value: "auto" } });
  type("안녕하세요");
  fireEvent.click(screen.getByRole("button", { name: "Dịch" }));

  expect(await screen.findByText("Đã nhận: Tiếng Hàn")).toBeInTheDocument();
});

test("lỗi trả về hiện bằng role alert", async () => {
  mockFetch({ error: "Tối đa 1.000 ký tự." }, 400);

  render(<TranslatePage />);
  type("Xin chào");
  fireEvent.click(screen.getByRole("button", { name: "Dịch" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Tối đa 1.000 ký tự.");
});

test("lịch sử khôi phục bản dịch cũ mà không gọi AI", async () => {
  mockFetch(TRANSLATION);
  localStorage.setItem(
    "translationHistory",
    JSON.stringify([
      {
        id: "h1",
        from: "vi",
        to: "zh",
        text: "Cảm ơn",
        translation: {
          detected: "vi",
          vietnamese: "Cảm ơn",
          results: [{ tone: "polite", text: "谢谢", reading: "xiè xie", note: "Lịch sự." }],
        },
        at: new Date().toISOString(),
      },
    ])
  );

  render(<TranslatePage />);
  fireEvent.click(screen.getByRole("button", { name: /Cảm ơn/ }));

  expect(screen.getByLabelText("Nội dung cần dịch")).toHaveValue("Cảm ơn");
  expect(screen.getByLabelText("Ngôn ngữ đích")).toHaveValue("zh");
  expect(await screen.findByText("谢谢")).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});
