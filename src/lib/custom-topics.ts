const KEY = "customTopics";

export function getCustomTopics(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((topic): topic is string => typeof topic === "string") : [];
  } catch { return []; }
}

export function saveCustomTopic(topic: string) {
  const trimmed = topic.trim();
  if (!trimmed || typeof window === "undefined") return;
  const existing = getCustomTopics();
  if (existing.some((item) => item.toLowerCase() === trimmed.toLowerCase())) return;
  localStorage.setItem(KEY, JSON.stringify([...existing, trimmed]));
}

export function deleteCustomTopic(topic: string) {
  if (typeof window === "undefined") return;
  const existing = getCustomTopics().filter((item) => item !== topic);
  localStorage.setItem(KEY, JSON.stringify(existing));
}
