import { expect, test } from '@playwright/test';

test('loads the collaboration room and its checked-in Wasm bridge', async ({ page }) => {
  await page.goto('/apps/collaboration');

  await expect(page.getByRole('heading', { name: 'Open a room' })).toBeVisible();
  await page.getByRole('button', { name: 'Create private room' }).click();
  await expect(page.getByRole('alert')).toContainText('Enter your name');

  const exports = await page.evaluate(async () => {
    const modulePath = '/iroh/collaboration_iroh.js';
    const wasm = (await import(modulePath)) as {
      default(): Promise<unknown>;
      CollaborationNode: { spawn: unknown };
    };
    await wasm.default();
    return typeof wasm.CollaborationNode.spawn;
  });
  expect(exports).toBe('function');
});

test('pipes a bounded stream through the download service worker', async ({ page }) => {
  await page.goto('/apps/collaboration');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();

  const result = await page.evaluate(async () => {
    const worker = navigator.serviceWorker.controller;
    if (!worker) throw new Error('service worker did not control the page');
    const id = crypto.randomUUID();
    const total = 2 * 1024 * 1024 + 13;
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent >= total) {
          controller.close();
          return;
        }
        const size = Math.min(64 * 1024, total - sent);
        controller.enqueue(new Uint8Array(size));
        sent += size;
      },
    });
    const channel = new MessageChannel();
    const accepted = new Promise<void>((resolve, reject) => {
      channel.port1.onmessage = (event: MessageEvent<{ ok: boolean; error?: string }>) => {
        if (event.data.ok) resolve();
        else reject(new Error(event.data.error));
      };
    });
    worker.postMessage(
      {
        type: 'register-stream-download',
        id,
        name: 'large test.bin',
        mediaType: 'application/octet-stream',
        size: total,
        stream,
      },
      [channel.port2, stream as unknown as Transferable],
    );
    await accepted;
    const response = await fetch(`/__e7g_stream_download__/${id}`);
    if (!response.body) throw new Error('download response had no body');
    let received = 0;
    const reader = response.body.getReader();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      received += chunk.value.byteLength;
    }
    return {
      received,
      length: response.headers.get('content-length'),
      disposition: response.headers.get('content-disposition'),
    };
  });

  expect(result.received).toBe(2 * 1024 * 1024 + 13);
  expect(result.length).toBe(String(2 * 1024 * 1024 + 13));
  expect(result.disposition).toContain("filename*=UTF-8''large%20test.bin");
});
