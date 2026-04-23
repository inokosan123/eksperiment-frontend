export const TITLE_BAR_BOTTOM_PADDING = 12;

export function getTitleBarTopPadding(topInset: number) {
  return topInset > 0 ? topInset + 8 : 12;
}
