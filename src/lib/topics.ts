// Word topics. The topic string goes to the AI and keys the word bank; the UI shows a Vietnamese label.

/** "No topic": the AI picks useful words across many everyday themes. Stored in the bank like any topic. */
export const RANDOM_TOPIC = "Random";

export const DEFAULT_TOPICS = ["Daily Communication", "TOEIC"];

const LABELS: Record<string, string> = {
  [RANDOM_TOPIC]: "Ngẫu nhiên",
  "Daily Communication": "Giao tiếp hằng ngày",
};

export function topicLabel(topic: string): string {
  return LABELS[topic] ?? topic;
}
