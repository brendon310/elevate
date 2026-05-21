// Forge Service Worker — Push Notifications + Offline Cache

const CACHE_NAME = 'forge-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.hostname.includes('supabase') || url.pathname.startsWith('/api/')) return;
  event.respondWith(
    fetch(event.request)
      .then(resp => {
        if (resp.ok && (APP_SHELL.includes(url.pathname) || url.pathname.endsWith('.js') || url.pathname.endsWith('.css'))) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return resp;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('/index.html')))
  );
});

self.addEventListener('push', function(event) {
  let data = { title: 'Forge', body: "You haven\'t checked in today. Your streak is waiting." };
  try { data = event.data.json(); } catch (_) {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Forge', {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'forge-daily',
      renotify: true,
      data: { url: '/home' },
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/home';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(targetUrl));
      if (existing) return existing.focus();
      if (list.length > 0) { list[0].focus(); return list[0].navigate(targetUrl); }
      return clients.openWindow(targetUrl);
    })
  );
});
