const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.8;

/** Scales so the long edge is at most `max`, keeping the aspect ratio; never upscales. */
export function fitSize(width: number, height: number, max = MAX_EDGE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Decodes a photo, shrinks it to 1,600 px and returns a JPEG data URL small enough for the request limit. */
export async function shrinkImage(file: File): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Không đọc được ảnh này.");
  }
  const { width, height } = fitSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Không đọc được ảnh này.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}
