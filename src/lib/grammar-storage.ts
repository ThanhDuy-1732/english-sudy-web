import { type GrammarTopic } from "./grammar-data";

const STORAGE_KEY = "grammarTopics";

export function getUserGrammarTopics(): GrammarTopic[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as GrammarTopic[]) : [];
  } catch {
    return [];
  }
}

export function saveUserGrammarTopic(topic: GrammarTopic): void {
  if (typeof window === "undefined") return;
  const topics = getUserGrammarTopics();
  const index = topics.findIndex((item) => item.id === topic.id);
  if (index >= 0) {
    topics[index] = topic;
  } else {
    topics.push(topic);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(topics));
}
