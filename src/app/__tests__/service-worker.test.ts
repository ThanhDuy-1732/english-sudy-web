/** @jest-environment node */
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

function worker(fetcher: typeof fetch) {
  const listeners: Record<string, (event: unknown) => void> = {};
  const entries = new Map<string, Response>();
  const cache = {
    put: async (key: string | Request, response: Response) => { entries.set(typeof key === "string" ? key : key.url, response); },
    match: async (key: string | Request) => entries.get(typeof key === "string" ? key : key.url)?.clone(),
  };
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    URL, Response, Request, AbortController, setTimeout, clearTimeout, console,
    self: { location: new URL("https://study.test/sw.js?v=test"), clients: { claim: async () => {} }, addEventListener: (name: string, handler: typeof listeners[string]) => { listeners[name] = handler; }, skipWaiting: jest.fn() },
    caches: { open: async () => cache, match: cache.match, keys: async () => [], delete: async () => true },
    fetch: fetcher,
  });
  const pending: Promise<unknown>[] = [];
  return {
    entries,
    idle: () => Promise.all(pending),
    install: () => new Promise<void>((resolve, reject) => { listeners.install({ waitUntil: (promise: Promise<void>) => promise.then(resolve, reject) }); }),
    navigate: (path: string) => new Promise<Response>((resolve, reject) => {
      listeners.fetch({ request: { url: `https://study.test${path}`, mode: "navigate", method: "GET", headers: new Headers() }, respondWith: (promise: Promise<Response>) => promise.then(resolve, reject), waitUntil: (promise: Promise<unknown>) => { pending.push(promise); } });
    }),
    rsc: async (path: string) => {
      let work: Promise<void> = Promise.resolve();
      const response = await new Promise<Response>((resolve, reject) => {
        listeners.fetch({ request: { url: `https://study.test${path}`, mode: "cors", method: "GET", headers: new Headers({ RSC: "1" }) }, respondWith: (promise: Promise<Response>) => promise.then(resolve, reject), waitUntil: (promise: Promise<void>) => { work = promise; } });
      });
      await work;
      return response;
    },
  };
}

test("a failed optional page does not prevent the worker from installing", async () => {
  const sw = worker(jest.fn(async (request) => {
    if (String(request) === "/stats") return new Response("unavailable", { status: 503 });
    return new Response("<html>cached</html>");
  }));
  await expect(sw.install()).resolves.toBeUndefined();
  expect(sw.entries.has("/grammar")).toBe(true);
  expect(sw.entries.has("/write/task/toeic-email")).toBe(true);
});

test("a cached page is available during an outage without mixing query strings", async () => {
  const fetcher = jest.fn(async () => new Response("<html>online</html>"));
  const sw = worker(fetcher);
  await sw.install();
  await sw.navigate("/history?topic=work");
  fetcher.mockImplementation(async () => { throw new Error("offline"); });
  const response = await sw.navigate("/history?topic=work");
  expect(await response.text()).toContain("online");
  expect(sw.entries.has("/history?topic=work")).toBe(true);
});

test("a page visited via Next Link has HTML cached separately from its Flight response", async () => {
  const sw = worker(jest.fn(async (request) => typeof request === "object"
    ? new Response("flight", { headers: { "content-type": "text/x-component" } })
    : new Response("<html>result</html>")));
  const flight = await sw.rsc("/write/result/saved-record?_rsc=123");
  expect(await flight.text()).toBe("flight");
  expect(await sw.entries.get("/write/result/saved-record")?.text()).toContain("<html>");
  expect(sw.entries.has("/write/result/saved-record?_rsc=123")).toBe(false);
});

test("a navigation is answered without waiting for its JS/CSS to be cached", async () => {
  let releaseAsset!: () => void;
  const gate = new Promise<void>((resolve) => { releaseAsset = resolve; });
  const sw = worker(jest.fn(async (request) => {
    if (String(request).includes("/_next/static/")) {
      await gate;
      return new Response("body{}", { headers: { "content-type": "text/css" } });
    }
    return new Response('<html><link href="/_next/static/app.css"></html>');
  }));
  const response = await sw.navigate("/history");
  expect(await response.text()).toContain("<html>");
  expect(sw.entries.has("https://study.test/_next/static/app.css")).toBe(false);
  releaseAsset();
  await sw.idle();
  expect(sw.entries.has("https://study.test/_next/static/app.css")).toBe(true);
  expect(sw.entries.has("/history")).toBe(true);
});
