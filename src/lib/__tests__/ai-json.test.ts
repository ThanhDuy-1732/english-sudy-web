import { z } from "zod";
import { stripFences, parseAiJson } from "../ai-json";

const schema = z.object({ name: z.string(), count: z.number() });

describe("stripFences", () => {
  it("strips ```json fence", () => {
    const raw = '```json\n{"name":"hi","count":1}\n```';
    expect(stripFences(raw)).toBe('{"name":"hi","count":1}');
  });

  it("strips preamble", () => {
    const raw = 'Here is the JSON:\n{"name":"hi","count":1}';
    expect(stripFences(raw)).toBe('{"name":"hi","count":1}');
  });

  it("strips postamble", () => {
    const raw = '{"name":"hi","count":1}\n\nLet me know if you need more.';
    expect(stripFences(raw)).toBe('{"name":"hi","count":1}');
  });

  it("handles plain JSON", () => {
    expect(stripFences('{"name":"hi","count":1}')).toBe('{"name":"hi","count":1}');
  });
});

describe("parseAiJson", () => {
  it("parses clean JSON", async () => {
    const result = await parseAiJson('{"name":"hi","count":1}', schema);
    expect(result).toEqual({ name: "hi", count: 1 });
  });

  it("parses JSON with ```json fence", async () => {
    const raw = '```json\n{"name":"hi","count":1}\n```';
    const result = await parseAiJson(raw, schema);
    expect(result).toEqual({ name: "hi", count: 1 });
  });

  it("parses JSON with preamble", async () => {
    const raw = 'Here is the JSON:\n{"name":"hi","count":1}';
    const result = await parseAiJson(raw, schema);
    expect(result).toEqual({ name: "hi", count: 1 });
  });

  it("calls repair on parse error", async () => {
    const repair = jest.fn().mockResolvedValue('{"name":"repaired","count":99}');
    const result = await parseAiJson("invalid json", schema, { repair });
    expect(repair).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ name: "repaired", count: 99 });
  });

  it("throws if no repair and parse fails", async () => {
    await expect(parseAiJson("invalid", schema)).rejects.toThrow();
  });
});
