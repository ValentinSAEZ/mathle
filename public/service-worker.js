/* Basic offline-first service worker */
// Bump this to force refresh after deploys
const CACHE_NAME = 'brainteaserday-v2';

// Build absolute URLs so this works on subpaths (e.g., GitHub Pages)
const scopeUrl = new URL(self.registration.scope);
const abs = (path) => new URL(path, scopeUrl).toString();

const CORE_ASSETS = [
  abs('index.html'),
  abs('manifest.json'),
  abs('offline.html'),
  abs('logo192.png'),
  abs('logo512.png')
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(()=>{});
          return response;
        })
        .catch(() => cached || caches.match('/offline.html'));
      return cached || fetchPromise;
    })
  );
});
