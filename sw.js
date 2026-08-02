// nini's workbench - Service Worker
const CACHE_NAME = 'nini-workbench-v45';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './avatar.jpg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './favicon.png'
];

// Install - cache all assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// Fetch - cache first, then network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests (e.g. Google Fonts)
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) {
    // For Google Fonts, try cache first then network
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(resp => {
          return resp;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Same-origin: 文档走「缓存优先 + 后台刷新」(stale-while-revalidate)。
  // 打开瞬间直接返回已缓存页面（<1s 秒开），后台静默拉取最新版写入缓存供下次使用。
  // 这样即使 Render 冷启动/休眠，UI 也立即呈现，不再白屏等待 30 秒。
  if (event.request.destination === 'document') {
    event.respondWith(
      caches.match('./index.html').then((cached) => {
        const network = fetch(event.request).then((resp) => {
          if (resp && resp.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resp.clone()));
          }
          return resp;
        }).catch(() => cached);
        // 优先返回缓存以实现瞬时首屏；后台网络请求只用于刷新缓存
        return cached || network;
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((resp) => {
        // Cache new resources
        if (resp.ok) {
          const respClone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, respClone));
        }
        return resp;
      }).catch(() => {
        // Offline fallback
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// Handle Web Push messages and surface them as native OS notifications.
// This is what lets reminders fire even when the app is fully closed.
self.addEventListener('push', (event) => {
  let data = { title: 'nini 提醒', body: '', tag: 'nini-push', url: './index.html' };
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = Object.assign(data, parsed);
    }
  } catch (e) { /* use defaults */ }
  const opts = {
    body: data.body || '',
    icon: data.icon || 'icon-192.png',
    badge: 'icon-192.png',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    tag: data.tag || 'nini-push',
    renotify: true,
    data: { url: data.url || './index.html' }
  };
  event.waitUntil(self.registration.showNotification(data.title || 'nini 提醒', opts));
});

// Handle notification clicks: focus the existing app window or open it
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './index.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus an already-open window
      for (const client of clientList) {
        if (client.url && client.url.indexOf(targetUrl) !== -1 && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
