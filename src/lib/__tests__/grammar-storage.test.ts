import { getUserGrammarTopics, saveUserGrammarTopic } from "../grammar-storage";

const mockTopic = {
  id: "test-topic",
  name: "Test Topic",
  isUserGenerated: true as const,
  createdAt: "2026-07-27T00:00:00.000Z",
  rules: [
    {
      id: "rule-1",
      name: "Rule One",
      formula: "S + V",
      explanation: "Basic sentence.",
      examples: ["He runs.", "She eats."],
    },
  ],
};

describe("grammar-storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns empty array when nothing stored", () => {
    expect(getUserGrammarTopics()).toEqual([]);
  });

  it("saves and retrieves a topic", () => {
    saveUserGrammarTopic(mockTopic);
    expect(getUserGrammarTopics()).toEqual([mockTopic]);
  });

  it("appends a second distinct topic", () => {
    saveUserGrammarTopic(mockTopic);
    const second = { ...mockTopic, id: "topic-2", name: "Topic 2" };
    saveUserGrammarTopic(second);
    expect(getUserGrammarTopics()).toHaveLength(2);
  });

  it("updates existing topic when id matches", () => {
    saveUserGrammarTopic(mockTopic);
    const updated = { ...mockTopic, name: "Updated Name" };
    saveUserGrammarTopic(updated);
    const result = getUserGrammarTopics();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Updated Name");
  });

  it("returns empty array when stored value is malformed JSON", () => {
    localStorage.setItem("grammarTopics", "not-json");
    expect(getUserGrammarTopics()).toEqual([]);
  });
});
