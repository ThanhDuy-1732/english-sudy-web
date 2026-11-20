import { type GrammarTopic, STATIC_GRAMMAR_TOPICS } from "./grammar-data";

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

export function getAllGrammarTopics(): GrammarTopic[] {
  return [...STATIC_GRAMMAR_TOPICS, ...getUserGrammarTopics()];
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

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** An existing topic matching a learner's request, so asking again skips the ~10 s AI call. */
export function findGrammarTopicForRequest(request: string): GrammarTopic | undefined {
  const wanted = norm(request);
  const slug = wanted.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return getAllGrammarTopics().find(
    (t) => (t.request && norm(t.request) === wanted) || norm(t.name) === wanted || t.id === slug
  );
}
