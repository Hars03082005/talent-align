// frontend/src/utils/format.ts

/**
 * Format a decimal or 0-100 score into a displayable percentage string (e.g. "84%").
 * If val <= 1.0 (and >= 0), it scales by 100 before rounding.
 * Otherwise, it rounds directly.
 */
export function formatPercent(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return '0%';
  const num = val <= 1.0 && val >= 0 ? val * 100 : val;
  return `${Math.round(num)}%`;
}

/**
 * Format a decimal or 0-100 score into a numeric percentage integer (0-100).
 */
export function formatPercentNumber(val: number | null | undefined): number {
  if (val == null || isNaN(val)) return 0;
  return Math.round(val <= 1.0 && val >= 0 ? val * 100 : val);
}
