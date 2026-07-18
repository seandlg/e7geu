/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const worker = self as unknown as ServiceWorkerGlobalScope;
const cacheName = `e7g-${version}`;
const precache = [...build, ...files];

worker.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(precache)));
  void worker.skipWaiting();
});

worker.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key))),
      )
      .then(() => worker.clients.claim()),
  );
});

worker.addEventListener('fetch', (event) => {
  if (
    event.request.method !== 'GET' ||
    new URL(event.request.url).origin !== worker.location.origin
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          void caches.open(cacheName).then((cache) => cache.put(event.request, response.clone()));
        }
        return response;
      });
    }),
  );
});

worker.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    worker.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const timerClient = clients.find(
        (client) => new URL(client.url).pathname === '/apps/break-timer',
      );
      if (timerClient && 'focus' in timerClient) return timerClient.focus();
      return worker.clients.openWindow('/apps/break-timer');
    }),
  );
});
