/**
 * Service Worker — offline support for WIAL platform.
 *
 * Strategy:
 * - Cache-first for static assets (CSS, JS, images)
 * - Network-first for API calls
 * - Cache previously visited pages for offline access
 *
 * Requirement: 9.2
 */

const CACHE_NAME = "wial-v1";
const STATIC_ASSETS = ["/", "/about", "/certification", "/coaches", "/events", "/resources", "/contact"];

// Install: pre-cache core static pages
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: route strategy based on request type
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // API calls: network-first
  if (url.pathname.startsWith("/api")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets (JS, CSS, images): cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Pages: network-first with cache fallback (caches visited pages)
  event.respondWith(networkFirstWithCache(request));
});

function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|webp|avif|svg|ico|woff2?)$/i.test(pathname) ||
    pathname.startsWith("/_next/static");
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({ error: "Offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function networkFirstWithCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response("Offline — this page is not cached yet.", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
