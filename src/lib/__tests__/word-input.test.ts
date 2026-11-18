import { MAX_CUSTOM_WORDS, parseWordInput } from "../word-input";

test("tách từ theo dấu phẩy, chấm phẩy và xuống dòng", () => {
  expect(parseWordInput("invoice, deadline; launch\nfollow up")).toEqual([
    "invoice",
    "deadline",
    "launch",
    "follow up",
  ]);
});

test("trim và gộp khoảng trắng bên trong", () => {
  expect(parseWordInput("  take   off ,  well  being ")).toEqual(["take off", "well being"]);
});

test("khử trùng không phân biệt hoa thường, giữ cách viết lần đầu", () => {
  expect(parseWordInput("Invoice, invoice, INVOICE, deadline")).toEqual(["Invoice", "deadline"]);
});

test("bỏ phần rỗng, chuỗi không có chữ cái và từ quá dài", () => {
  expect(parseWordInput(",  , 123, ok, " + "a".repeat(41) + ", fine")).toEqual(["ok", "fine"]);
});

test("giới hạn số từ mỗi lần thêm", () => {
  const input = Array.from({ length: MAX_CUSTOM_WORDS + 5 }, (_, i) => `word${i}`).join(", ");
  expect(parseWordInput(input)).toHaveLength(MAX_CUSTOM_WORDS);
});

test("giữ dấu gạch nối và nháy đơn", () => {
  expect(parseWordInput("well-known, don't, e-mail")).toEqual(["well-known", "don't", "e-mail"]);
});
