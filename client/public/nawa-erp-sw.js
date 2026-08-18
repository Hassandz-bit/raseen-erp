const CACHE_NAME = "nawa-erp-shell-v1";
const APP_SHELL = "/";
const OFFLINE_PAGE = "/offline.html";

const isSameOrigin = url => url.origin === self.location.origin;
const isApiRequest = url => url.pathname.startsWith("/api/");

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll([APP_SHELL, OFFLINE_PAGE])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("nawa-erp-shell-") && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "CLEAR_NAWA_ERP_CACHE") event.waitUntil(caches.delete(CACHE_NAME));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || !isSameOrigin(url) || isApiRequest(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(APP_SHELL, copy));
      return response;
    }).catch(() => caches.match(OFFLINE_PAGE)));
    return;
  }

  const destination = request.destination;
  if (["script", "style", "image", "font", "manifest"].includes(destination)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      return response;
    })));
  }
});
