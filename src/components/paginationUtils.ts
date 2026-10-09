export type PageItem = number | 'ellipsis-left' | 'ellipsis-right';

/**
 * Builds the visible page list: always the first and last page, the current page and
 * `siblings` neighbours on each side, with ellipses for the skipped ranges.
 * The result length is constant (2 * siblings + 5) once there are enough pages, so the
 * control never changes width as the page count grows.
 *
 *   getPageItems(1, 29, 1)  -> 1 2 3 4 5 … 29
 *   getPageItems(15, 29, 1) -> 1 … 14 15 16 … 29
 *   getPageItems(29, 29, 1) -> 1 … 25 26 27 28 29
 */
export function getPageItems(current: number, total: number, siblings = 1): PageItem[] {
  const slots = siblings * 2 + 5;
  if (total <= slots) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i);

  const page = Math.min(Math.max(current, 1), total);
  const left = Math.max(page - siblings, 1);
  const right = Math.min(page + siblings, total);
  const showLeftEllipsis = left > 2;
  const showRightEllipsis = right < total - 1;
  const edgeCount = 3 + siblings * 2;

  if (!showLeftEllipsis && showRightEllipsis) {
    return [...range(1, edgeCount), 'ellipsis-right', total];
  }
  if (showLeftEllipsis && !showRightEllipsis) {
    return [1, 'ellipsis-left', ...range(total - edgeCount + 1, total)];
  }
  return [1, 'ellipsis-left', ...range(left, right), 'ellipsis-right', total];
}
