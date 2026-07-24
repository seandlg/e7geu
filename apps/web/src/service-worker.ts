/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const worker = self as unknown as ServiceWorkerGlobalScope;
const cacheName = `e7g-${version}`;
const aiAssetPrefix = '/ai/';
const streamDownloadPrefix = '/__e7g_stream_download__/';
const precache = [...build, ...files].filter((path) => !path.startsWith(aiAssetPrefix));
const streamDownloads = new Map<
  string,
  { stream: ReadableStream<Uint8Array>; name: string; mediaType: string; size: number }
>();

worker.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(precache)));
  void worker.skipWaiting();
});

worker.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('e7g-') && key !== cacheName)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => worker.clients.claim()),
  );
});

worker.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  if (
    event.request.method === 'GET' &&
    requestUrl.origin === worker.location.origin &&
    requestUrl.pathname.startsWith(streamDownloadPrefix)
  ) {
    const id = requestUrl.pathname.slice(streamDownloadPrefix.length);
    const download = streamDownloads.get(id);
    streamDownloads.delete(id);
    event.respondWith(
      download
        ? Promise.resolve(
            new Response(download.stream, {
              headers: {
                'Cache-Control': 'no-store',
                'Content-Disposition': contentDisposition(download.name),
                'Content-Length': String(download.size),
                'Content-Type': download.mediaType,
              },
            }),
          )
        : Promise.resolve(new Response('Download stream expired.', { status: 404 })),
    );
    return;
  }
  if (
    event.request.method !== 'GET' ||
    requestUrl.origin !== worker.location.origin ||
    requestUrl.pathname.startsWith(aiAssetPrefix)
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

worker.addEventListener('message', (event) => {
  const data = event.data as Record<string, unknown> | null;
  const responsePort = event.ports[0];
  if (data?.type !== 'register-stream-download' || !responsePort) return;
  if (
    typeof data.id !== 'string' ||
    typeof data.name !== 'string' ||
    data.name.length === 0 ||
    data.name.length > 255 ||
    typeof data.mediaType !== 'string' ||
    data.mediaType.length > 255 ||
    typeof data.size !== 'number' ||
    !Number.isSafeInteger(data.size) ||
    data.size <= 0 ||
    !(data.stream instanceof ReadableStream)
  ) {
    responsePort.postMessage({ ok: false, error: 'Invalid download stream.' });
    return;
  }
  streamDownloads.set(data.id, {
    stream: data.stream as ReadableStream<Uint8Array>,
    name: data.name,
    mediaType: data.mediaType,
    size: data.size,
  });
  setTimeout(() => {
    const expired = streamDownloads.get(data.id as string);
    if (!expired) return;
    streamDownloads.delete(data.id as string);
    void expired.stream.cancel('Download was not started.');
  }, 30_000);
  responsePort.postMessage({ ok: true });
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

function contentDisposition(name: string): string {
  const fallback = name
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_')
    .slice(0, 180);
  const encoded = encodeURIComponent(name).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fallback || 'download'}"; filename*=UTF-8''${encoded}`;
}
