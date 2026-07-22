/// <reference lib="webworker" />

import * as ort from 'onnxruntime-web/wasm';
import { MODEL_HEIGHT, MODEL_WIDTH, imagePlacement, modelInput, normalizedAlpha } from './model.ts';
import type { ModelProgress, WorkerRequest, WorkerResponse } from './protocol.ts';

const worker = self as unknown as DedicatedWorkerGlobalScope;
const modelUrl = '/ai/u2netp/onnx/model.onnx';
const modelInputName = 'input.1';
const modelOutputName = '1959';

ort.env.wasm.wasmPaths = '/ai/runtime/';

let sessionPromise: Promise<ort.InferenceSession> | null = null;

worker.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  void handleRequest(event.data);
});

async function handleRequest(request: WorkerRequest): Promise<void> {
  try {
    const session = await getSession(request.id);
    if (request.type === 'prepare') {
      respond({ id: request.id, type: 'ready' });
      return;
    }

    respond({
      id: request.id,
      type: 'result',
      image: await removeBackground(session, request.image),
    });
  } catch (cause) {
    sessionPromise = null;
    respond({
      id: request.id,
      type: 'error',
      message: cause instanceof Error ? cause.message : 'Background removal failed.',
    });
  }
}

function getSession(requestId: number): Promise<ort.InferenceSession> {
  sessionPromise ??= createSession(requestId);
  return sessionPromise;
}

async function createSession(requestId: number): Promise<ort.InferenceSession> {
  const model = await downloadModel((progress) => {
    respond({ id: requestId, type: 'progress', progress });
  });
  return ort.InferenceSession.create(model, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });
}

async function downloadModel(onProgress: (progress: ModelProgress) => void): Promise<Uint8Array> {
  const response = await fetch(modelUrl);
  if (!response.ok) throw new Error(`The AI model could not be downloaded (${response.status}).`);

  const total = Number(response.headers.get('content-length')) || 0;
  if (!response.body) {
    const model = new Uint8Array(await response.arrayBuffer());
    onProgress({ loaded: model.byteLength, total: total || model.byteLength });
    return model;
  }

  const chunks: Uint8Array[] = [];
  const reader = response.body.getReader();
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress({ loaded, total: total || loaded });
  }

  const model = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    model.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return model;
}

async function removeBackground(session: ort.InferenceSession, image: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(image);
  try {
    const placement = imagePlacement(bitmap.width, bitmap.height);
    const inputCanvas = new OffscreenCanvas(MODEL_WIDTH, MODEL_HEIGHT);
    const inputContext = context2d(inputCanvas);
    inputContext.fillStyle = '#000';
    inputContext.fillRect(0, 0, MODEL_WIDTH, MODEL_HEIGHT);
    inputContext.drawImage(bitmap, placement.x, placement.y, placement.width, placement.height);

    const pixels = inputContext.getImageData(0, 0, MODEL_WIDTH, MODEL_HEIGHT).data;
    const tensor = new ort.Tensor('float32', modelInput(pixels), [1, 3, MODEL_HEIGHT, MODEL_WIDTH]);
    const output = await session.run({ [modelInputName]: tensor }, [modelOutputName]);
    const mask = output[modelOutputName];
    if (!mask || !(mask.data instanceof Float32Array)) {
      throw new Error('The AI model returned an invalid mask.');
    }

    return renderResult(bitmap, mask.data, placement);
  } finally {
    bitmap.close();
  }
}

async function renderResult(
  bitmap: ImageBitmap,
  mask: Float32Array,
  placement: ReturnType<typeof imagePlacement>,
): Promise<Blob> {
  const maskCanvas = new OffscreenCanvas(MODEL_WIDTH, MODEL_HEIGHT);
  const maskContext = context2d(maskCanvas);
  const maskPixels = maskContext.createImageData(MODEL_WIDTH, MODEL_HEIGHT);
  const alpha = normalizedAlpha(mask);
  for (let index = 0; index < alpha.length; index += 1) {
    const pixel = index * 4;
    maskPixels.data[pixel] = alpha[index];
    maskPixels.data[pixel + 1] = alpha[index];
    maskPixels.data[pixel + 2] = alpha[index];
    maskPixels.data[pixel + 3] = 255;
  }
  maskContext.putImageData(maskPixels, 0, 0);

  const resizedMask = new OffscreenCanvas(bitmap.width, bitmap.height);
  const resizedMaskContext = context2d(resizedMask);
  resizedMaskContext.drawImage(
    maskCanvas,
    placement.x,
    placement.y,
    placement.width,
    placement.height,
    0,
    0,
    bitmap.width,
    bitmap.height,
  );

  const outputCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const outputContext = context2d(outputCanvas);
  outputContext.drawImage(bitmap, 0, 0);
  const outputPixels = outputContext.getImageData(0, 0, bitmap.width, bitmap.height);
  const resizedMaskPixels = resizedMaskContext.getImageData(0, 0, bitmap.width, bitmap.height).data;
  for (let pixel = 0; pixel < outputPixels.data.length; pixel += 4) {
    outputPixels.data[pixel + 3] = resizedMaskPixels[pixel];
  }
  outputContext.putImageData(outputPixels, 0, 0);
  return outputCanvas.convertToBlob({ type: 'image/png' });
}

function context2d(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot process images off the main thread.');
  return context;
}

function respond(message: WorkerResponse): void {
  worker.postMessage(message);
}
