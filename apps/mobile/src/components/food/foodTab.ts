import type { ColorTokens } from '@/theme';

const FOOD_TABS = ['foodTabRose', 'foodTabBlush', 'foodTabSage', 'foodTabKhaki'] as const;

/**
 * Tab color for a food row. Foods have no category, so this is only a stable hash of the id:
 * the same food always gets the same color, and the color means nothing.
 */
export function foodTabToken(foodId: string): keyof ColorTokens {
  let hash = 0;
  for (let index = 0; index < foodId.length; index += 1) {
    hash = (hash * 31 + foodId.charCodeAt(index)) | 0;
  }
  return FOOD_TABS[Math.abs(hash) % FOOD_TABS.length]!;
}
