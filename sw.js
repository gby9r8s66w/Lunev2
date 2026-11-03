/* LUNARPACE sw.js — offline-first service worker */
var CACHE_NAME = "lunarpace-v1";
var APP_SHELL = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "moon.js",
  "store.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE_NAME) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  // cache-first, fall back to network, then cache the result
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      if (cached) return cached;
      return fetch(e.request).then(function (resp) {
        if (!resp || resp.status !== 200 || resp.type === "error") return resp;
        var clone = resp.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(e.request, clone);
        });
        return resp;
      }).catch(function () { return cached; });
    })
  );
});
