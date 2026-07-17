const CACHE_PREFIX = "english-study";
const CACHE_VERSION = new URL(self.location.href).searchParams.get("v") || "development";
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;
const PAGE_URLS = ["/", "/history", "/review", "/import", "/stats"];
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
  const response = await fetch(request, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Không thể precache ${String(request)}: ${response.status}`);
  }

  await cache.put(cacheKey, response.clone());
  return response;
}

async function precachePage(cache, pathname) {
  const response = await fetchAndCache(cache, pathname, pathname);
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
      await Promise.all(PAGE_URLS.map((url) => precachePage(cache, url)));
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith(`${CACHE_PREFIX}-`) && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  const url = new URL(request.url);
  const cacheKey = url.pathname;

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(cacheKey, response.clone());
    }
    return response;
  } catch {
    return (await cache.match(cacheKey)) || (await cache.match("/offline.html"));
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
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
  if (isRscRequest) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
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
