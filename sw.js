/* 韭菜进化论 · 轻量 PWA 缓存 */
const CACHE = 'leek-finance-v6-2026-10-28';
const ASSETS = [
  './',
  './index.html',
  './online.html',
  './manifest.webmanifest',
  './assets/style.css',
  './assets/online.css',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-180.png',
  './js/concepts.js',
  './js/terms.js',
  './js/questions.js',
  './js/cases.js',
  './js/engine.js',
  './js/app.js',
  './js/online/config.js',
  './js/online/game.js',
  './js/online/supabase.js',
  './js/online/online.js',
  './js/online/cloud-save.js',
  './js/vendor/supabase.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Supabase/API 不缓存

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(req).then(hit => hit || caches.match('./index.html'))
      )
    );
    return;
  }

  // 配置文件必须拿最新的，否则改了 Supabase URL 还读到旧缓存。
  if (url.pathname.endsWith('/js/online/config.js')) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
