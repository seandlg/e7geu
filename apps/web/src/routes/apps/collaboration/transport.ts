export const MAX_CHAT_BYTES = 4_000;
const FILE_CHUNK_BYTES = 64 * 1024;

export type FileOffer = {
  id: string;
  name: string;
  mediaType: string;
  size: number;
};

export type FileRequest = {
  requestId: number;
  roomId: string;
  fileId: string;
  requester: string;
};

export type RoomEvent =
  | { type: 'chat'; from: string; nickname: string; text: string; sentTimestamp: number }
  | { type: 'presence'; from: string; nickname: string; sentTimestamp: number }
  | {
      type: 'fileOffered';
      from: string;
      nickname: string;
      offer: FileOffer;
      sentTimestamp: number;
    }
  | { type: 'neighborUp'; endpointId: string }
  | { type: 'neighborDown'; endpointId: string }
  | { type: 'lagged' };

export type WasmRoom = {
  id(): string;
  receiver(): ReadableStream<RoomEvent>;
  file_requests(): ReadableStream<FileRequest>;
  ticket(): string;
  send_chat(text: string): Promise<void>;
  offer_file(id: string, name: string, mediaType: string, size: bigint): Promise<unknown>;
  request_file(
    provider: string,
    fileId: string,
    expectedSize: bigint,
  ): Promise<ReadableStream<Uint8Array>>;
  respond_file(requestId: bigint, source: ReadableStream<Uint8Array>, size: bigint): Promise<void>;
  reject_file(requestId: bigint, message: string): Promise<void>;
  free?(): void;
};

export type WasmNode = {
  endpoint_id(): string;
  create(nickname: string): Promise<WasmRoom>;
  join(ticket: string, nickname: string): Promise<WasmRoom>;
  shutdown(): Promise<void>;
  free?(): void;
};

type WasmModule = {
  default(input?: string | URL | Request): Promise<unknown>;
  CollaborationNode: { spawn(): Promise<WasmNode> };
};

export type CollaborationSession = {
  endpointId: string;
  roomId: string;
  events: ReadableStream<RoomEvent>;
  inviteToken(): string;
  sendChat(text: string): Promise<string>;
  offerFile(file: File): Promise<FileOffer>;
  downloadFile(provider: string, offer: FileOffer): Promise<ReadableStream<Uint8Array>>;
  close(): Promise<void>;
};

export async function createRoom(name: string): Promise<CollaborationSession> {
  const node = await createNode();
  try {
    return createSessionFromWasm(node, await node.create(cleanName(name)));
  } catch (error) {
    await node.shutdown();
    throw error;
  }
}

export async function joinRoom(ticket: string, name: string): Promise<CollaborationSession> {
  const token = ticket.trim();
  if (!token) throw new Error('This invite link is incomplete.');
  const node = await createNode();
  try {
    return createSessionFromWasm(node, await node.join(token, cleanName(name)));
  } catch (error) {
    await node.shutdown();
    throw error;
  }
}

async function createNode(): Promise<WasmNode> {
  const modulePath = '/iroh/collaboration_iroh.js';
  const wasm = (await import(/* @vite-ignore */ modulePath)) as WasmModule;
  await wasm.default();
  return wasm.CollaborationNode.spawn();
}

export function createSessionFromWasm(node: WasmNode, room: WasmRoom): CollaborationSession {
  let closed = false;
  const offeredFiles = new Map<string, File>();
  const requestReader = room.file_requests().getReader();
  void answerFileRequests(room, requestReader, offeredFiles);
  return {
    endpointId: node.endpoint_id(),
    roomId: room.id(),
    events: room.receiver(),
    inviteToken: () => room.ticket(),
    async sendChat(text) {
      const clean = cleanChat(text);
      await room.send_chat(clean);
      return clean;
    },
    async offerFile(file) {
      validateFile(file);
      const id = crypto.randomUUID();
      offeredFiles.set(id, file);
      try {
        return parseFileOffer(
          await room.offer_file(
            id,
            file.name,
            file.type || 'application/octet-stream',
            BigInt(file.size),
          ),
        );
      } catch (error) {
        offeredFiles.delete(id);
        throw error;
      }
    },
    async downloadFile(provider, offer) {
      validateOffer(offer);
      if (!provider.trim()) throw new Error('This file provider is invalid.');
      return room.request_file(provider, offer.id, BigInt(offer.size));
    },
    async close() {
      if (closed) return;
      closed = true;
      await requestReader.cancel().catch(() => undefined);
      offeredFiles.clear();
      await node.shutdown();
      room.free?.();
      node.free?.();
    },
  };
}

async function answerFileRequests(
  room: WasmRoom,
  reader: ReadableStreamDefaultReader<FileRequest>,
  offeredFiles: Map<string, File>,
): Promise<void> {
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) return;
      const request = result.value;
      const file = offeredFiles.get(request.fileId);
      if (!file) {
        await room
          .reject_file(BigInt(request.requestId), 'The sender no longer has this file open.')
          .catch(() => undefined);
        continue;
      }
      await room
        .respond_file(BigInt(request.requestId), streamFile(file), BigInt(file.size))
        .catch(() => undefined);
    }
  } catch {
    // Closing a room cancels this reader. Individual transfer failures are reported to requesters.
  }
}

export function streamFile(file: File): ReadableStream<Uint8Array> {
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (offset >= file.size) {
        controller.close();
        return;
      }
      const end = Math.min(offset + FILE_CHUNK_BYTES, file.size);
      const bytes = new Uint8Array(await file.slice(offset, end).arrayBuffer());
      offset = end;
      controller.enqueue(bytes);
    },
  });
}

export function cleanName(value: string): string {
  const name = value.trim().slice(0, 32);
  if (!name) throw new Error('Enter your name first.');
  return name;
}

export function cleanChat(value: string): string {
  const text = value.trim();
  if (!text) throw new Error('Write a message first.');
  if (new TextEncoder().encode(text).byteLength > MAX_CHAT_BYTES) {
    throw new Error('Messages are limited to 4,000 bytes.');
  }
  return text;
}

export function validateFile(file: Pick<File, 'name' | 'size'>): void {
  if (!file.name.trim()) throw new Error('Choose a named file.');
  if (file.size === 0) throw new Error('The selected file is empty.');
  if (!Number.isSafeInteger(file.size) || file.size < 0) {
    throw new Error('The selected file size is invalid.');
  }
}

function parseFileOffer(value: unknown): FileOffer {
  if (!isRecord(value)) throw new Error('Iroh returned an invalid file offer.');
  const offer = {
    id: value.id,
    name: value.name,
    mediaType: value.mediaType,
    size: value.size,
  };
  validateOffer(offer);
  return offer;
}

function validateOffer(value: unknown): asserts value is FileOffer {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.mediaType !== 'string' ||
    typeof value.size !== 'number' ||
    value.size <= 0 ||
    !Number.isSafeInteger(value.size)
  ) {
    throw new Error('This file offer is invalid.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
