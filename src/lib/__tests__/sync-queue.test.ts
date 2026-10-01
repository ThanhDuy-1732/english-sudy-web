import { enqueue, dequeue, peekQueue, markFailed, getQueueLength, drainQueue, registerProcessor } from "../sync-queue";

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

test("keeps an in-flight entry persisted and retries a failure only once per drain", async () => {
  const processor = jest.fn(async () => {
    expect(getQueueLength()).toBe(1);
    throw new Error("temporary outage");
  });
  registerProcessor("learnedWords", processor);
  enqueue({ entity: "learnedWords", entityId: "a", op: "upsert", payload: {} });
  await drainQueue();
  await drainQueue();
  expect(processor).toHaveBeenCalledTimes(1);
  expect(peekQueue()[0].retryCount).toBe(1);
  expect(localStorage.getItem("syncFailedQueue")).toBeNull();
});

test("does not drop entries without a registered processor", async () => {
  enqueue({ entity: "learningSessions", entityId: "a", op: "upsert", payload: {} });
  await drainQueue();
  expect(getQueueLength()).toBe(1);
});
