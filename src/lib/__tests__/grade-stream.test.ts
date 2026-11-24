import { createFieldScanner } from "../grade-stream";
import { readGradeStream } from "../read-grade-stream";
import { gradeStreamResponse } from "../test-support/grade-stream-mock";

const JSON_TEXT = '```json\n{"bands":{"task":6,"note":"a, \\"b\\" }"},"overall":6,"list":[1,[2,3]],"s":"x,y"}\n```';

test("scanner emits each top-level field once, however the text is chunked", () => {
  for (const size of [1, 3, 7, JSON_TEXT.length]) {
    const scan = createFieldScanner();
    const got: [string, unknown][] = [];
    for (let i = 0; i < JSON_TEXT.length; i += size) got.push(...scan(JSON_TEXT.slice(i, i + size)));
    expect(got).toEqual([["bands", { task: 6, note: 'a, "b" }' }], ["overall", 6], ["list", [1, [2, 3]]], ["s", "x,y"]]);
  }
});

test("a field is not emitted before its value is complete", () => {
  const scan = createFieldScanner();
  expect(scan('{"overall":6,"annotations":[{"a":')).toEqual([["overall", 6]]);
});

test("readGradeStream reports fields and resolves with the validated whole", async () => {
  const seen: string[] = [];
  const data = await readGradeStream<{ overall: number }>(gradeStreamResponse({ overall: 7, nextFocus: "x" }) as unknown as Response, (k) => seen.push(k));
  expect(seen).toEqual(["overall", "nextFocus"]);
  expect(data.overall).toBe(7);
});
