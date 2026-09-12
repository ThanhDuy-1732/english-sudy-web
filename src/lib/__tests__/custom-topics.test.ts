import { deleteCustomTopic, getCustomTopics, saveCustomTopic } from "../custom-topics";

beforeEach(() => localStorage.clear());

test("custom topics start empty", () => expect(getCustomTopics()).toEqual([]));
test("saves trimmed topic", () => { saveCustomTopic("  Business Email "); expect(getCustomTopics()).toEqual(["Business Email"]); });
test("ignores empty and case-insensitive duplicates", () => { saveCustomTopic("Cooking"); saveCustomTopic(" cooking "); saveCustomTopic(" "); expect(getCustomTopics()).toEqual(["Cooking"]); });
test("deleteCustomTopic removes the topic", () => {
  saveCustomTopic("Cooking");
  saveCustomTopic("Travel");
  deleteCustomTopic("Cooking");
  expect(getCustomTopics()).toEqual(["Travel"]);
});
test("deleteCustomTopic is a no-op when topic does not exist", () => {
  saveCustomTopic("Cooking");
  deleteCustomTopic("Unknown");
  expect(getCustomTopics()).toEqual(["Cooking"]);
});
