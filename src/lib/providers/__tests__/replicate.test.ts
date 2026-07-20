const mockFetch = jest.fn();
global.fetch = mockFetch as typeof fetch;

const noopSleep = () => Promise.resolve();

import { ReplicateProvider } from "../replicate";

beforeEach(() => mockFetch.mockReset());

const provider = new ReplicateProvider(
  "test-key",
  "meta/llama-4-scout-17b-16e-instruct",
  noopSleep
);

test("provider has correct metadata", () => {
  expect(provider.id).toBe("replicate");
  expect(provider.name).toBe("Replicate");
  expect(provider.model).toBe("meta/llama-4-scout-17b-16e-instruct");
});

test("generateContent returns immediately when initial status is succeeded", async () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ id: "p1", status: "succeeded", output: ["hello", " world"] }),
  });
  expect(await provider.generateContent("hi")).toBe("hello world");
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

test("generateContent polls until succeeded", async () => {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "p1", status: "starting" }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "p1", status: "processing" }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "p1", status: "succeeded", output: ["done"] }),
    });
  expect(await provider.generateContent("test")).toBe("done");
  expect(mockFetch).toHaveBeenCalledTimes(3);
});

test("generateContent throws when prediction fails", async () => {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "p1", status: "starting" }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "p1", status: "failed", error: "GPU OOM" }),
    });
  await expect(provider.generateContent("test")).rejects.toThrow("GPU OOM");
});

test("generateContent throws with { status } on non-2xx create response", async () => {
  mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });
  await expect(provider.generateContent("test")).rejects.toMatchObject({ status: 429 });
});

test("generateContent throws with { status } on non-2xx poll response", async () => {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "p1", status: "starting" }),
    })
    .mockResolvedValueOnce({ ok: false, status: 503 });
  await expect(provider.generateContent("test")).rejects.toMatchObject({ status: 503 });
});

test("generateContent throws timeout after 20 polls", async () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ id: "p1", status: "starting" }),
  });
  for (let i = 0; i < 20; i++) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "p1", status: "processing" }),
    });
  }
  await expect(provider.generateContent("test")).rejects.toThrow("timed out");
});
