import { fileURLToPath } from 'node:url';
import * as ort from 'onnxruntime-web';
import { describe, expect, it } from 'vite-plus/test';
import { MODEL_HEIGHT, MODEL_WIDTH } from './model.ts';

const modelPath = fileURLToPath(
  new URL('../../../../static/ai/u2netp/onnx/model.onnx', import.meta.url),
);

describe('U²-NetP ONNX integration', () => {
  it('creates a session and returns the expected foreground mask', async () => {
    ort.env.wasm.numThreads = 1;
    const session = await ort.InferenceSession.create(modelPath, {
      executionProviders: ['wasm'],
    });
    const input = new ort.Tensor('float32', new Float32Array(3 * MODEL_WIDTH * MODEL_HEIGHT), [
      1,
      3,
      MODEL_HEIGHT,
      MODEL_WIDTH,
    ]);

    const result = await session.run({ 'input.1': input }, ['1959']);

    expect(session.inputNames).toContain('input.1');
    expect(session.outputNames).toContain('1959');
    expect(result['1959']?.dims).toEqual([1, 1, MODEL_HEIGHT, MODEL_WIDTH]);
  }, 15_000);
});
