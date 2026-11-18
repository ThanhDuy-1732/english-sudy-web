import { runWordJob } from "../word-job-runner";

function makeDeps(overrides: Partial<Parameters<typeof runWordJob>[0]> = {}) {
  let count = 0;
  let added = 0;
  const deps = {
    topic: "TOEIC",
    target: 40,
    countBank: () => count,
    fetchBatch: jest.fn(async () => ({
      ok: true as const,
      words: [
        { word: `w${count + 1}`, meaning: "m" },
        { word: `w${count + 2}`, meaning: "m" },
      ],
    })),
    addWords: (words: { word: string; meaning: string }[]) => {
      const n = words.length;
      count += n;
      added += n;
      return { added: n, persisted: true };
    },
    pickExclude: () => [],
    wait: jest.fn(async () => {}),
    shouldContinue: () => true,
    ...overrides,
  };
  return { deps, getCount: () => count, getAdded: () => added };
}

test("dừng khi đạt target", async () => {
  const { deps, getAdded } = makeDeps({ target: 6 });
  await expect(runWordJob(deps)).resolves.toEqual({ reason: "done", wordsAdded: 6 });
  expect(getAdded()).toBe(6);
});

test("dừng exhausted sau 3 lô không thêm từ", async () => {
  const { deps } = makeDeps({ addWords: () => ({ added: 0, persisted: true }) });
  await expect(runWordJob(deps)).resolves.toMatchObject({ reason: "exhausted" });
  expect(deps.fetchBatch).toHaveBeenCalledTimes(3);
});

test("429 chờ retryAfter rồi chạy tiếp, không tính lỗi", async () => {
  let first = true;
  let count = 0;
  const { deps } = makeDeps({
    target: 1,
    countBank: () => count,
    fetchBatch: jest.fn(async () => {
      if (first) {
        first = false;
        return { ok: false as const, status: 429, retryAfterSec: 7 };
      }
      return { ok: true as const, words: [{ word: "a", meaning: "m" }] };
    }),
    addWords: () => {
      count += 1;
      return { added: 1, persisted: true };
    },
  });
  const result = await runWordJob(deps);
  expect(result.reason).toBe("done");
  expect(deps.wait).toHaveBeenCalledWith(7000);
});

test("429 liên tục 5 lần thì dừng để không treo vô hạn", async () => {
  const { deps } = makeDeps({
    target: 100,
    fetchBatch: jest.fn(async () => ({ ok: false as const, status: 429, retryAfterSec: 1 })),
  });
  await expect(runWordJob(deps)).resolves.toMatchObject({ reason: "error" });
  expect(deps.fetchBatch).toHaveBeenCalledTimes(5);
});

test("ghi bank thất bại dừng ngay với reason storage", async () => {
  const { deps } = makeDeps({ addWords: () => ({ added: 2, persisted: false }) });
  await expect(runWordJob(deps)).resolves.toMatchObject({ reason: "storage" });
  expect(deps.fetchBatch).toHaveBeenCalledTimes(1);
});

test("huỷ giữa chừng không gọi thêm", async () => {
  let calls = 0;
  const { deps } = makeDeps({
    target: 100,
    shouldContinue: () => calls < 2,
    fetchBatch: jest.fn(async () => {
      calls++;
      return { ok: true as const, words: [{ word: `w${calls}`, meaning: "m" }] };
    }),
    addWords: () => ({ added: 1, persisted: true }),
  });
  await expect(runWordJob(deps)).resolves.toMatchObject({ reason: "cancelled" });
  expect(calls).toBe(2);
});
