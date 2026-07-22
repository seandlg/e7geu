export type ModelProgress = {
  loaded: number;
  total: number;
};

export type WorkerRequest =
  | { id: number; type: 'prepare' }
  | { id: number; type: 'remove'; image: Blob };

export type WorkerRequestPayload = { type: 'prepare' } | { type: 'remove'; image: Blob };

export type WorkerResponse =
  | { id: number; type: 'progress'; progress: ModelProgress }
  | { id: number; type: 'ready' }
  | { id: number; type: 'result'; image: Blob }
  | { id: number; type: 'error'; message: string };
