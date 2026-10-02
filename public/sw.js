const CACHE_PREFIX = "english-study";
const CACHE_VERSION = new URL(self.location.href).searchParams.get("v") || "development";
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;
const pendingAssets = new Map();
const PAGE_URLS = [
  "/", "/history", "/review", "/import", "/stats", "/diary", "/activity", "/today", "/path", "/library", "/mistakes", "/settings",
  "/grammar", "/grammar/quiz", "/vocab/quiz", "/vocab/context", "/exam", "/exam/mock", "/exam/mistakes",
  "/speak", "/speak/history", "/speak/shadowing", "/write", "/write/history",
  ...["RC5", "RC6", "RC7", "LC2", "LC3", "LC4", "READ_P3", "LISTEN_S1"].map((part) => `/exam/drill/${part}`),
  ...["p1", "p2", "p3"].map((part) => `/speak/ielts/${part}`),
  ...["hotel", "interview", "complaint", "restaurant", "doctor", "shopping"].map((id) => `/speak/roleplay/${id}`),
  ...["task2-opinion", "task2-discuss", "task1-line", "task1-bar", "toeic-email"].map((id) => `/write/task/${id}`),
];
const CORE_URLS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

function sameOriginAssetUrls(source) {
  const urls = new Set();
  const attributePattern = /(?:src|href)=["']([^"']+)["']/g;
  let match;

  while ((match = attributePattern.exec(source)) !== null) {
    const url = new URL(match[1], self.location.origin);
    if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
      urls.add(url.href);
    }
  }

  return [...urls];
}

function cssAssetUrls(source, baseUrl) {
  const urls = new Set();
  const urlPattern = /url\(["']?([^"')]+)["']?\)/g;
  let match;

  while ((match = urlPattern.exec(source)) !== null) {
    const url = new URL(match[1], baseUrl);
    if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
      urls.add(url.href);
    }
  }

  return [...urls];
}

async function fetchAndCache(cache, request, cacheKey = request) {
  const isAsset = String(request).includes("/_next/static/");
  if (isAsset) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (pendingAssets.has(request)) return (await pendingAssets.get(request)).clone();
  }
  const task = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(request, { cache: "no-cache", signal: controller.signal });
      if (!response.ok) throw new Error(`Không thể precache ${String(request)}: ${response.status}`);
      await cache.put(cacheKey, response.clone());
      return response;
    } finally {
      clearTimeout(timeout);
    }
  })();
  if (isAsset) pendingAssets.set(request, task);
  try {
    return await task;
  } finally {
    if (isAsset) pendingAssets.delete(request);
  }
}

async function precachePage(cache, pathname) {
  const response = await fetchAndCache(cache, pathname, pathname);
  await cachePageAssets(cache, response);
}

async function cachePageAssets(cache, response) {
  const assetUrls = sameOriginAssetUrls(await response.clone().text());
  const assetResponses = await Promise.all(
    assetUrls.map(async (assetUrl) => {
      const assetResponse = await fetchAndCache(cache, assetUrl);
      return { assetUrl, assetResponse };
    }),
  );

  const cssAssets = assetResponses.flatMap(({ assetUrl, assetResponse }) => {
    return assetResponse.headers.get("content-type")?.includes("text/css")
      ? [{ assetUrl, assetResponse }]
      : [];
  });

  await Promise.allSettled(
    cssAssets.map(async ({ assetUrl, assetResponse }) => {
      const nestedUrls = cssAssetUrls(await assetResponse.clone().text(), assetUrl);
      await Promise.allSettled(nestedUrls.map((url) => fetchAndCache(cache, url)));
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(CORE_URLS.map((url) => fetchAndCache(cache, url)));
      await Promise.allSettled(PAGE_URLS.map((url) => precachePage(cache, url)));
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      // Keep the previous build's assets for other tabs until the next update.
      const previous = cacheNames.filter((name) => name.startsWith(`${CACHE_PREFIX}-`) && name !== CACHE_NAME);
      await Promise.all(
        previous.slice(0, -1).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

async function networkFirstNavigation(request, event) {
  const cache = await caches.open(CACHE_NAME);
  const url = new URL(request.url);
  const cacheKey = url.pathname + url.search;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(request, { signal: controller.signal });
    // The timeout only guards time-to-headers; a slow body must not be aborted mid-stream.
    clearTimeout(timeout);
    if (response.ok) {
      const copy = response.clone();
      // Visited dynamic pages need their own HTML/JS/CSS for a later offline launch,
      // but caching them must not delay this navigation.
      event.waitUntil(
        (async () => {
          await cache.put(cacheKey, copy.clone());
          await cachePageAssets(cache, copy);
        })().catch(() => {}),
      );
    } else {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
    }
    return response;
  } catch {
    return (await cache.match(cacheKey)) || (await cache.match(url.pathname)) || (await cache.match("/offline.html"));
  } finally {
    clearTimeout(timeout);
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = (await cache.match(request)) || (await caches.match(request));
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  const isRscRequest =
    request.headers.has("RSC") ||
    request.headers.has("Next-Router-Prefetch") ||
    url.searchParams.has("_rsc");
  // Keep Flight patches separate from HTML. Next 14 falls back to a full-page
  // navigation offline; save the corresponding HTML for routes visited via Link.
  if (isRscRequest) {
    const network = fetch(request);
    event.respondWith(network);
    url.searchParams.delete("_rsc");
    const cacheKey = url.pathname + url.search;
    event.waitUntil(network.then(async (response) => {
      if (!response.ok) return;
      const cache = await caches.open(CACHE_NAME);
      if (!(await cache.match(cacheKey))) await precachePage(cache, cacheKey);
    }).catch(() => {}));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request, event));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(cacheFirst(request));
  }
});
