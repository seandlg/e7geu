import { describe, expect, it, vi } from 'vite-plus/test';
import { monitoredStream } from './download';

describe('streaming collaboration downloads', () => {
  it('forwards bounded chunks and reports byte progress', async () => {
    const progress = vi.fn();
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3, 4, 5]));
        controller.close();
      },
    });
    const monitored = monitoredStream(source, 5, progress);
    const bytes = new Uint8Array(await new Response(monitored.stream).arrayBuffer());

    await expect(monitored.completed).resolves.toBeUndefined();
    expect(bytes).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
    expect(progress.mock.calls).toEqual([[2], [5]]);
  });

  it('rejects a stream that ends before its advertised size', async () => {
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.close();
      },
    });
    const monitored = monitoredStream(source, 3, () => undefined);

    await expect(new Response(monitored.stream).arrayBuffer()).rejects.toThrow('disconnected');
    await expect(monitored.completed).rejects.toThrow('disconnected');
  });
});
