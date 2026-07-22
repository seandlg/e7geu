/// <reference lib="webworker" />

import { env, pipeline } from '@huggingface/transformers';
import type { ModelProgress, WorkerRequest, WorkerResponse } from './protocol.ts';

const worker = self as unknown as DedicatedWorkerGlobalScope;

env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = '/ai/';
const wasm = env.backends.onnx.wasm;
if (!wasm) throw new Error('The local AI runtime is unavailable.');
wasm.wasmPaths = '/ai/runtime/';

let removerPromise: ReturnType<typeof createRemover> | null = null;

worker.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  void handleRequest(event.data);
});

async function handleRequest(request: WorkerRequest): Promise<void> {
  try {
    const remover = await getRemover(request.id);
    if (request.type === 'prepare') {
      respond({ id: request.id, type: 'ready' });
      return;
    }

    const output = await remover(request.image);
    respond({ id: request.id, type: 'result', image: await output.toBlob('image/png') });
  } catch (cause) {
    removerPromise = null;
    respond({
      id: request.id,
      type: 'error',
      message: cause instanceof Error ? cause.message : 'Background removal failed.',
    });
  }
}

function getRemover(requestId: number): ReturnType<typeof createRemover> {
  removerPromise ??= createRemover(requestId);
  return removerPromise;
}

async function createRemover(requestId: number) {
  return pipeline('background-removal', 'u2netp', {
    device: 'wasm',
    dtype: 'fp32',
    progress_callback: (event) => {
      if (event.status !== 'progress_total') return;
      const progress: ModelProgress = { loaded: event.loaded, total: event.total };
      respond({ id: requestId, type: 'progress', progress });
    },
  });
}

function respond(message: WorkerResponse): void {
  worker.postMessage(message);
}
