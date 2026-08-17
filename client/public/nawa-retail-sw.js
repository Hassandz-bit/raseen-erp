const RETAIL_SHELL_CACHE = "nawa-retail-shell-v1";
const RETAIL_FALLBACK = "/retailer";

self.addEventListener("install", event => {
  event.waitUntil(caches.open(RETAIL_SHELL_CACHE).then(cache => cache.add(RETAIL_FALLBACK)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("nawa-retail-shell-") && key !== RETAIL_SHELL_CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("message", event => {
  if (event.data?.type === "CLEAR_NAWA_RETAIL_CACHE") event.waitUntil(caches.delete(RETAIL_SHELL_CACHE));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone();
      caches.open(RETAIL_SHELL_CACHE).then(cache => cache.put(request, copy));
      return response;
    }).catch(() => caches.match(request).then(cached => cached || caches.match(RETAIL_FALLBACK))));
  }
});
