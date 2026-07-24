export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_CHAT_BYTES = 4_000;

export type FileOffer = {
  id: string;
  name: string;
  mediaType: string;
  size: number;
  ticket: string;
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
  ticket(): string;
  send_chat(text: string): Promise<void>;
  offer_file(data: Uint8Array, name: string, mediaType: string): Promise<unknown>;
  download_file(ticket: string): Promise<Uint8Array>;
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
  downloadFile(offer: FileOffer): Promise<Blob>;
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
      const raw = await room.offer_file(
        new Uint8Array(await file.arrayBuffer()),
        file.name,
        file.type || 'application/octet-stream',
      );
      return parseFileOffer(raw);
    },
    async downloadFile(offer) {
      validateOffer(offer);
      const bytes = await room.download_file(offer.ticket);
      if (bytes.byteLength !== offer.size) {
        throw new Error('The downloaded file does not match the advertised size.');
      }
      return new Blob([bytes.slice()], { type: offer.mediaType });
    },
    async close() {
      if (closed) return;
      closed = true;
      await node.shutdown();
      room.free?.();
      node.free?.();
    },
  };
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
  if (file.size > MAX_FILE_BYTES) throw new Error('Files are limited to 25 MiB.');
}

function parseFileOffer(value: unknown): FileOffer {
  if (!isRecord(value)) throw new Error('Iroh returned an invalid file offer.');
  const offer = {
    id: value.id,
    name: value.name,
    mediaType: value.mediaType,
    size: value.size,
    ticket: value.ticket,
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
    typeof value.ticket !== 'string' ||
    value.size <= 0 ||
    value.size > MAX_FILE_BYTES
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
