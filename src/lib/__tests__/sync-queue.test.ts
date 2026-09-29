import { enqueue, dequeue, peekQueue, markFailed, getQueueLength } from "../sync-queue";

beforeEach(() => { localStorage.clear(); });

test("enqueue adds entry to queue", () => {
  enqueue({ entity: "learnedWords", entityId: "test-word", op: "upsert", payload: { word: "test" } });
  expect(getQueueLength()).toBe(1);
});

test("dequeue returns and removes first entry (FIFO)", () => {
  enqueue({ entity: "learnedWords", entityId: "a", op: "upsert", payload: { word: "a" } });
  enqueue({ entity: "learnedWords", entityId: "b", op: "upsert", payload: { word: "b" } });
  const entry = dequeue();
  expect(entry?.entityId).toBe("a");
  expect(getQueueLength()).toBe(1);
});

test("peekQueue returns all entries without removing", () => {
  enqueue({ entity: "learnedWords", entityId: "x", op: "upsert", payload: {} });
  enqueue({ entity: "examAttempts", entityId: "y", op: "upsert", payload: {} });
  expect(peekQueue()).toHaveLength(2);
  expect(getQueueLength()).toBe(2);
});

test("markFailed increments retryCount and re-queues if below max", () => {
  enqueue({ entity: "learnedWords", entityId: "a", op: "upsert", payload: {} });
  const entry = dequeue()!;
  markFailed(entry);
  expect(getQueueLength()).toBe(1);
  expect(peekQueue()[0].retryCount).toBe(1);
});

test("markFailed moves to failedQueue after max retries", () => {
  enqueue({ entity: "learnedWords", entityId: "a", op: "upsert", payload: {} });
  let entry = dequeue()!;
  for (let i = 0; i < 5; i++) {
    entry = { ...entry, retryCount: i };
    markFailed(entry);
    if (i < 4) entry = dequeue()!;
  }
  expect(getQueueLength()).toBe(0);
});
