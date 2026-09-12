import { z, ZodTypeAny } from "zod";

export function stripFences(raw: string) {
  return raw
    .replace(/```(?:json)?/gi, "")
    .trim()
    .replace(/^[^{[]*/, "") // cắt preamble
    .replace(/[^}\]]*$/, ""); // cắt postamble
}

export async function parseAiJson<T extends ZodTypeAny>(
  raw: string,
  schema: T,
  opts?: { repair?: (err: string) => Promise<string> }
): Promise<z.infer<T>> {
  const attempt = (s: string) => schema.parse(JSON.parse(stripFences(s)));
  try {
    return attempt(raw);
  } catch (e) {
    if (!opts?.repair) throw e;
    return attempt(await opts.repair(String(e)));
  }
}
