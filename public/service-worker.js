/* Basic offline-first service worker */
// Bump this to force refresh after deploys
const CACHE_NAME = 'brainteaserday-static-v3';

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
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('brainteaserday-') && k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Never intercept API/authentication requests or third-party resources.
  if (request.method !== 'GET' || url.origin !== scopeUrl.origin ||
      url.pathname.startsWith('/api/') || request.headers.has('Authorization')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(abs('offline.html'))));
    return;
  }
  if (!['script', 'style', 'image', 'font', 'manifest'].includes(request.destination)) return;
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (!response.ok || response.headers.get('Cache-Control')?.includes('no-store')) return response;
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(()=>{});
          return response;
        })
        .catch(() => cached || caches.match('/offline.html'));
      return cached || fetchPromise;
    })
  );
});
