/** @jest-environment node */
import { NextRequest } from "next/server";

jest.mock("@/lib/ai-tasks", () => ({ callTask: jest.fn(), streamTask: jest.fn() }));
const { callTask, streamTask } = jest.requireMock("@/lib/ai-tasks");

const ROUTES = [
  "generate-words", "generate-sentence", "generate-synonyms", "generate-batch", "generate-fillblank", "generate-reading",
  "grade-sentence", "grammar-generate", "grammar-examples", "grammar-exercise", "vocab/context",
  "exam/generate-item", "exam/grade-open", "exam/explain", "write/grade", "write/model-answer", "speech/grade",
];

const post = async (route: string, body: string) => {
  const { POST } = await import(`../${route}/route`);
  return POST(new NextRequest(`http://localhost/api/${route}`, { method: "POST", body }));
};

test.each(ROUTES)("%s answers 400, without an AI call, to a body that is not a JSON object", async (route) => {
  for (const body of ["{bad", "null", "[1]"]) expect((await post(route, body)).status).toBe(400);
  expect(callTask).not.toHaveBeenCalled();
  expect(streamTask).not.toHaveBeenCalled();
});

test.each(["exam/generate-item", "exam/grade-open", "exam/explain"])("%s rejects missing fields before any AI call", async (route) => {
  expect((await post(route, "{}")).status).toBe(400);
  expect(callTask).not.toHaveBeenCalled();
});

test("exam/generate-item rejects a part that does not belong to the exam, and a bad level", async () => {
  for (const body of [{ kind: "TOEIC", part: "READ_P1", level: 3 }, { kind: "TOEIC", part: "RC5", level: 9 }, { kind: "toString", part: "RC5", level: 3 }]) {
    expect((await post("exam/generate-item", JSON.stringify(body))).status).toBe(400);
  }
  expect(callTask).not.toHaveBeenCalled();
});
