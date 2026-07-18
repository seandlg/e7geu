export type MeasuredBlock = { id: string; height: number };
export type PageLayout = { blockIds: string[]; overflow: boolean };

export function paginateBlocks(
  blocks: readonly MeasuredBlock[],
  capacity: number,
  gap: number,
): PageLayout[] {
  if (blocks.length === 0) return [];
  const pages: PageLayout[] = [];
  let blockIds: string[] = [];
  let used = 0;
  let overflow = false;

  for (const block of blocks) {
    const nextHeight = block.height + (blockIds.length > 0 ? gap : 0);
    if (blockIds.length > 0 && used + nextHeight > capacity) {
      pages.push({ blockIds, overflow });
      blockIds = [];
      used = 0;
      overflow = false;
    }
    blockIds.push(block.id);
    used += block.height + (blockIds.length > 1 ? gap : 0);
    overflow ||= block.height > capacity;
  }
  pages.push({ blockIds, overflow });
  return pages;
}
