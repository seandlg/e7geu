import type { ModelProgress, WorkerRequestPayload, WorkerResponse } from './protocol.ts';

export type BackgroundRemover = {
  prepare(onProgress: (progress: ModelProgress) => void): Promise<void>;
  remove(image: Blob): Promise<Blob>;
  dispose(): void;
};

type PendingRequest = {
  resolve(value: void | Blob): void;
  reject(reason: Error): void;
  onProgress?: (progress: ModelProgress) => void;
};

export function createBackgroundRemover(): BackgroundRemover {
  const worker = new Worker(new URL('./background-remover.worker.ts', import.meta.url), {
    type: 'module',
  });
  const pending = new Map<number, PendingRequest>();
  let nextId = 1;
  let disposed = false;

  worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;
    const request = pending.get(message.id);
    if (!request) return;

    if (message.type === 'progress') {
      request.onProgress?.(message.progress);
      return;
    }

    pending.delete(message.id);
    if (message.type === 'error') request.reject(new Error(message.message));
    else if (message.type === 'result') request.resolve(message.image);
    else request.resolve();
  });

  worker.addEventListener('error', () => {
    rejectAll(new Error('The local AI worker stopped unexpectedly. Try again.'));
  });

  function request<T extends void | Blob>(
    message: WorkerRequestPayload,
    onProgress?: (progress: ModelProgress) => void,
  ): Promise<T> {
    if (disposed) return Promise.reject(new Error('The local AI worker has been closed.'));
    const id = nextId++;
    return new Promise<T>((resolve, reject) => {
      pending.set(id, {
        resolve: resolve as (value: void | Blob) => void,
        reject,
        onProgress,
      });
      worker.postMessage({ ...message, id });
    });
  }

  function rejectAll(error: Error): void {
    for (const item of pending.values()) item.reject(error);
    pending.clear();
  }

  return {
    prepare: (onProgress) => request<void>({ type: 'prepare' }, onProgress),
    remove: (image) => request<Blob>({ type: 'remove', image }),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      rejectAll(new Error('Background removal was cancelled.'));
      worker.terminate();
    },
  };
}
