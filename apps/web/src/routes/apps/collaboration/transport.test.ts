import { describe, expect, it, vi } from 'vite-plus/test';
import {
  MAX_FILE_BYTES,
  cleanChat,
  cleanName,
  createSessionFromWasm,
  formatBytes,
  validateFile,
  type WasmNode,
  type WasmRoom,
} from './transport';

describe('collaboration transport', () => {
  it('normalizes names and chat at the interface', () => {
    expect(cleanName('  Ada  ')).toBe('Ada');
    expect(cleanChat('  hello  ')).toBe('hello');
    expect(() => cleanName('   ')).toThrow('Enter your name');
    expect(() => cleanChat('   ')).toThrow('Write a message');
  });

  it('rejects empty and oversized files before crossing into Wasm', () => {
    expect(() => validateFile({ name: 'empty.txt', size: 0 })).toThrow('empty');
    expect(() => validateFile({ name: 'large.bin', size: MAX_FILE_BYTES + 1 })).toThrow('25 MiB');
  });

  it('wraps the narrow Wasm room interface', async () => {
    const send = vi.fn(async () => undefined);
    const shutdown = vi.fn(async () => undefined);
    const room: WasmRoom = {
      id: () => 'topic',
      receiver: () => new ReadableStream(),
      ticket: () => 'invite',
      send_chat: send,
      offer_file: async () => ({
        id: 'hash',
        name: 'notes.txt',
        mediaType: 'text/plain',
        size: 5,
        ticket: 'blob-ticket',
      }),
      download_file: async () => new Uint8Array([104, 101, 108, 108, 111]),
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
    await session.close();
    await session.close();
    expect(shutdown).toHaveBeenCalledOnce();
  });

  it('formats file sizes for the room UI', () => {
    expect(formatBytes(8)).toBe('8 B');
    expect(formatBytes(1536)).toBe('1.5 KiB');
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MiB');
  });
});
