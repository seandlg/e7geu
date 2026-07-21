import { describe, expect, it } from 'vite-plus/test';
import { createTransportFromNode, type WasmNode } from './transport';

describe('Arcana Iroh transport', () => {
  it('passes request IDs back using the BigInt expected by wasm-bindgen', () => {
    let receivedId: unknown;
    const node: WasmNode = {
      endpoint_id: () => 'host',
      events: () => new ReadableStream(),
      request: async () => JSON.stringify({ ok: false, error: 'unused' }),
      respond(requestId) {
        receivedId = requestId;
      },
    };

    createTransportFromNode(node).respond(1, { ok: false, error: 'test' });

    expect(receivedId).toBe(1n);
  });
});
