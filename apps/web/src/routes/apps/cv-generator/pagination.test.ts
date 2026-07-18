import { describe, expect, it } from 'vite-plus/test';
import { paginateBlocks } from './pagination';

describe('paginateBlocks', () => {
  it('packs blocks and accounts for gaps', () => {
    expect(
      paginateBlocks(
        [
          { id: 'a', height: 40 },
          { id: 'b', height: 50 },
          { id: 'c', height: 20 },
        ],
        100,
        10,
      ),
    ).toEqual([
      { blockIds: ['a', 'b'], overflow: false },
      { blockIds: ['c'], overflow: false },
    ]);
  });

  it('keeps an oversized block visible and reports overflow', () => {
    expect(paginateBlocks([{ id: 'long', height: 120 }], 100, 8)).toEqual([
      { blockIds: ['long'], overflow: true },
    ]);
  });
});
