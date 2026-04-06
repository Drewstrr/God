const CACHE_NAME = 'zaky-v1';

// Fișiere esențiale care se salvează offline la prima vizită
const PRECACHE = [
  '/crew-zaky.html',
  '/manifest.json'
];

// Install: pre-cache fișierele esențiale
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

// Activate: șterge cache-urile vechi
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: cache-first pentru fișiere locale, network-first pentru externe (CDN, fonts, Supabase)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Resurse externe (CDN, Google Fonts, Supabase) — nu le cache-uim, le cerem din rețea
  if (url.origin !== self.location.origin) {
    return; // browser handles normally
  }

  // Fișiere locale — cache first, fallback network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
