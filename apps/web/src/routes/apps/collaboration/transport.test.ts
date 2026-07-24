import { describe, expect, it, vi } from 'vite-plus/test';
import {
  cleanChat,
  cleanName,
  createSessionFromWasm,
  formatBytes,
  streamFile,
  validateFile,
  type WasmNode,
  type WasmRoom,
  type FileRequest,
} from './transport';

describe('collaboration transport', () => {
  it('normalizes names and chat at the interface', () => {
    expect(cleanName('  Ada  ')).toBe('Ada');
    expect(cleanChat('  hello  ')).toBe('hello');
    expect(() => cleanName('   ')).toThrow('Enter your name');
    expect(() => cleanChat('   ')).toThrow('Write a message');
  });

  it('rejects empty files but accepts large live-transfer sources', () => {
    expect(() => validateFile({ name: 'empty.txt', size: 0 })).toThrow('empty');
    expect(() => validateFile({ name: 'large.bin', size: 1024 ** 3 })).not.toThrow();
  });

  it('wraps the narrow Wasm room interface', async () => {
    const send = vi.fn(async () => undefined);
    const shutdown = vi.fn(async () => undefined);
    const respondFile = vi.fn(async () => undefined);
    let requestController!: ReadableStreamDefaultController<FileRequest>;
    const fileRequests = new ReadableStream<FileRequest>({
      start(controller) {
        requestController = controller;
      },
    });
    const room: WasmRoom = {
      id: () => 'topic',
      receiver: () => new ReadableStream(),
      file_requests: () => fileRequests,
      ticket: () => 'invite',
      send_chat: send,
      offer_file: async (id) => ({
        id,
        name: 'notes.txt',
        mediaType: 'text/plain',
        size: 5,
      }),
      request_file: async () => new ReadableStream(),
      respond_file: respondFile,
      reject_file: async () => undefined,
    };
    const node: WasmNode = {
      endpoint_id: () => 'me',
      create: async () => room,
      join: async () => room,
      shutdown,
    };
    const session = createSessionFromWasm(node, room);

    expect(session.endpointId).toBe('me');
    expect(session.inviteToken()).toBe('invite');
    await expect(session.sendChat(' hello ')).resolves.toBe('hello');
    expect(send).toHaveBeenCalledWith('hello');
    const offered = await session.offerFile(
      new File(['hello'], 'notes.txt', { type: 'text/plain' }),
    );
    requestController.enqueue({
      requestId: 7,
      roomId: 'topic',
      fileId: offered.id,
      requester: 'peer',
    });
    await vi.waitFor(() => expect(respondFile).toHaveBeenCalled());
    expect(respondFile).toHaveBeenCalledWith(7n, expect.any(ReadableStream), 5n);
    await session.close();
    await session.close();
    expect(shutdown).toHaveBeenCalledOnce();
  });

  it('formats file sizes for the room UI', () => {
    expect(formatBytes(8)).toBe('8 B');
    expect(formatBytes(1536)).toBe('1.5 KiB');
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MiB');
  });

  it('reads browser files in bounded chunks', async () => {
    const file = new File([new Uint8Array(150_000)], 'large.bin');
    const reader = streamFile(file).getReader();
    const sizes: number[] = [];
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      sizes.push(result.value.byteLength);
    }

    expect(sizes).toEqual([65_536, 65_536, 18_928]);
  });
});
