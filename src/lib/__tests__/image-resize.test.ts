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
