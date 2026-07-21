import type { RoomRequest, RoomResponse } from './room';

type IncomingRequest = { requestId: number; endpointId: string; payload: string };

type WasmNode = {
  endpoint_id(): string;
  events(): ReadableStream<IncomingRequest>;
  request(endpointId: string, payload: string): Promise<string>;
  respond(requestId: number, response: string): void;
};

type WasmModule = {
  default(input?: string | URL | Request): Promise<unknown>;
  ArcanaNode: { spawn(): Promise<WasmNode> };
};

export type ArcanaTransport = {
  endpointId: string;
  requests: ReadableStream<IncomingRequest>;
  request(hostId: string, request: RoomRequest): Promise<RoomResponse>;
  respond(requestId: number, response: RoomResponse): void;
};

export async function createTransport(): Promise<ArcanaTransport> {
  const modulePath = '/iroh/arcana_iroh.js';
  const wasm = (await import(/* @vite-ignore */ modulePath)) as WasmModule;
  await wasm.default();
  const node = await wasm.ArcanaNode.spawn();
  return {
    endpointId: node.endpoint_id(),
    requests: node.events(),
    async request(hostId, request) {
      return parseResponse(await node.request(hostId, JSON.stringify(request)));
    },
    respond(requestId, response) {
      node.respond(requestId, JSON.stringify(response));
    },
  };
}

function parseResponse(value: string): RoomResponse {
  const response: unknown = JSON.parse(value);
  if (typeof response !== 'object' || response === null || !('ok' in response)) {
    throw new Error('The host returned an invalid response');
  }
  return response as RoomResponse;
}

export function createSecret(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}
