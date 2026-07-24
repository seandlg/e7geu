import type { FileOffer } from './transport';

const DOWNLOAD_PREFIX = '/__e7g_stream_download__/';

type SavePickerWindow = Window & {
  showSaveFilePicker?: (options: { suggestedName: string }) => Promise<FileSystemFileHandle>;
};

export type DownloadTarget = {
  save(source: ReadableStream<Uint8Array>, onProgress: (received: number) => void): Promise<void>;
};

export async function prepareDownload(offer: FileOffer): Promise<DownloadTarget> {
  const picker = (window as SavePickerWindow).showSaveFilePicker;
  if (picker) {
    const handle = await picker.call(window, {
      suggestedName: offer.name,
    });
    return {
      async save(source, onProgress) {
        const writable = await handle.createWritable();
        const monitored = monitoredStream(source, offer.size, onProgress);
        try {
          await Promise.all([monitored.stream.pipeTo(writable), monitored.completed]);
        } catch (error) {
          await writable.abort(error).catch(() => undefined);
          throw error;
        }
      },
    };
  }

  const registration = await navigator.serviceWorker.ready;
  const serviceWorker = navigator.serviceWorker.controller ?? registration.active;
  if (!serviceWorker) {
    throw new Error('Streaming downloads are not ready yet. Reload this page and try again.');
  }
  return {
    async save(source, onProgress) {
      const id = crypto.randomUUID();
      const monitored = monitoredStream(source, offer.size, onProgress);
      const channel = new MessageChannel();
      const accepted = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('The browser download service did not respond.')),
          5_000,
        );
        channel.port1.onmessage = (event: MessageEvent<{ ok: boolean; error?: string }>) => {
          clearTimeout(timer);
          if (event.data.ok) resolve();
          else reject(new Error(event.data.error || 'The browser rejected the download stream.'));
        };
      });
      serviceWorker.postMessage(
        {
          type: 'register-stream-download',
          id,
          name: offer.name,
          mediaType: offer.mediaType,
          size: offer.size,
          stream: monitored.stream,
        },
        [channel.port2, monitored.stream as unknown as Transferable],
      );
      await accepted;

      const link = document.createElement('a');
      link.href = `${DOWNLOAD_PREFIX}${id}`;
      link.download = offer.name;
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
      await monitored.completed;
    },
  };
}

export function monitoredStream(
  source: ReadableStream<Uint8Array>,
  expectedSize: number,
  onProgress: (received: number) => void,
): { stream: ReadableStream<Uint8Array>; completed: Promise<void> } {
  const reader = source.getReader();
  let received = 0;
  let resolveCompleted!: () => void;
  let rejectCompleted!: (reason: unknown) => void;
  const completed = new Promise<void>((resolve, reject) => {
    resolveCompleted = resolve;
    rejectCompleted = reject;
  });
  // The stream can fail before its consumer awaits `completed` (for example,
  // while the service worker is accepting it). Mark that early rejection as
  // handled while preserving the promise for the caller's eventual await.
  void completed.catch(() => undefined);
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result = await reader.read();
        if (result.done) {
          if (received !== expectedSize) {
            throw new Error('The sender disconnected before the file was complete.');
          }
          controller.close();
          resolveCompleted();
          return;
        }
        if (!(result.value instanceof Uint8Array)) {
          throw new Error('The file transfer returned an invalid chunk.');
        }
        received += result.value.byteLength;
        if (received > expectedSize) {
          throw new Error('The file exceeded its advertised size.');
        }
        onProgress(received);
        controller.enqueue(result.value);
      } catch (error) {
        controller.error(error);
        rejectCompleted(error);
        await reader.cancel(error).catch(() => undefined);
      }
    },
    async cancel(reason) {
      rejectCompleted(reason);
      await reader.cancel(reason);
    },
  });
  return { stream, completed };
}
