import type { PrayerBlock, PrayerCategory } from '@/data/prayers/prayerCatalog';

export const DEFAULT_ORTHODOX_CATEGORY: PrayerCategory = 'jesus';
export const PRAYER_PREVIEW_BASE_BLOCKS = 6;
export const PRAYER_PREVIEW_MAX_BLOCKS = 8;

/**
 * Builds the small excerpt used on the interactive Prayer Book screen.
 *
 * The complete section remains untouched for the reader. The excerpt has a
 * hard native-node ceiling and, where possible, includes the spoken line after
 * a rubric instead of ending on an instruction such as "Then:".
 */
export function getPrayerPreviewBlocks(blocks: PrayerBlock[]): PrayerBlock[] {
  if (blocks.length <= PRAYER_PREVIEW_MAX_BLOCKS) return blocks;

  let count = PRAYER_PREVIEW_BASE_BLOCKS;
  while (
    count < PRAYER_PREVIEW_MAX_BLOCKS
    && blocks[count - 1]?.type !== 'text'
  ) {
    count += 1;
  }

  return blocks.slice(0, count);
}
