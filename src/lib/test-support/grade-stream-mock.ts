import { TextDecoder, TextEncoder } from "util";

// jsdom has neither; readGradeStream needs the decoder.
Object.assign(globalThis, { TextEncoder, TextDecoder });

/** A fetch response whose body streams `data` the way gradeStream does (one `field` line per key, then `done`). */
export function gradeStreamResponse(data: Record<string, unknown>) {
  const lines = [...Object.entries(data).map(([k, v]) => ({ t: "field", k, v })), { t: "done", data }].map((e) => `${JSON.stringify(e)}\n`);
  const chunks = lines.map((l) => new TextEncoder().encode(l));
  return {
    ok: true,
    body: { getReader: () => ({ read: async () => (chunks.length ? { done: false, value: chunks.shift() } : { done: true, value: undefined }) }) },
  };
}
