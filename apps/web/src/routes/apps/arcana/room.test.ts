import { describe, expect, it } from 'vite-plus/test';
import { HostRoom } from './room';

describe('Arcana host room', () => {
  it('authenticates the invite secret and keeps hands private', () => {
    const room = new HostRoom('host', 'Ada', 'secret');
    expect(room.handle('b', { type: 'join', secret: 'wrong', name: 'Bryn' })).toEqual({
      ok: false,
      error: 'This invite is not valid',
    });
    const joined = room.handle('b', { type: 'join', secret: 'secret', name: 'Bryn' });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;
    expect(joined.view.players[0]).not.toHaveProperty('hand');
    expect(joined.view.hand).toEqual([]);
  });

  it('rejects commands from an unseated endpoint', () => {
    const room = new HostRoom('host', 'Ada', 'secret');
    expect(room.handle('stranger', { type: 'sync', secret: 'secret' })).toEqual({
      ok: false,
      error: 'Join the table before playing',
    });
  });
});
