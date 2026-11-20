import { fitSize, shrinkImage } from "../image-resize";

test("fitSize keeps the aspect ratio under 1600 px and never upscales", () => {
  expect(fitSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
  expect(fitSize(1200, 3000)).toEqual({ width: 640, height: 1600 });
  expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 });
});

test("shrinkImage rejects with a readable message when the image cannot be decoded", async () => {
  (globalThis as unknown as { createImageBitmap: unknown }).createImageBitmap = jest.fn().mockRejectedValue(new Error("bad"));
  await expect(shrinkImage(new File(["x"], "a.heic"))).rejects.toThrow("Không đọc được ảnh này.");
});

test("shrinkImage paints a white background so transparent PNGs stay readable", async () => {
  const calls: string[] = [];
  const context: { fillStyle: string; fillRect: jest.Mock; drawImage: jest.Mock } = {
    fillStyle: "",
    fillRect: jest.fn(() => calls.push(`fill ${context.fillStyle}`)),
    drawImage: jest.fn(() => calls.push("draw")),
  };
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  jest.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,QQ==");
  (globalThis as unknown as { createImageBitmap: unknown }).createImageBitmap = jest
    .fn()
    .mockResolvedValue({ width: 10, height: 10, close: jest.fn() });

  await shrinkImage(new File(["x"], "a.png"));
  expect(calls).toEqual(["fill #ffffff", "draw"]);
});
