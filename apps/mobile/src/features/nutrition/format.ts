/** Whole number with thousands separators: 2068 -> "2,068". */
export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}
