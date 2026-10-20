/** 台股常用的數值顯示格式。null / undefined / NaN 一律顯示為「—」（例如金融業沒有毛利率）。 */

export const EMPTY = "—";

type Num = number | null | undefined;

const isMissing = (v: Num): v is null | undefined => v === null || v === undefined || !Number.isFinite(v);

export function formatNumber(v: Num, digits = 2): string {
  if (isMissing(v)) return EMPTY;
  return v.toLocaleString("zh-TW", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** 輸入值已經是百分比數字（例如 12.3 代表 12.3%）。 */
export function formatPercent(v: Num, digits = 2, { signed = false } = {}): string {
  if (isMissing(v)) return EMPTY;
  const sign = signed && v > 0 ? "+" : "";
  return `${sign}${formatNumber(v, digits)}%`;
}

/** 以「元」為單位的金額，轉成兆、億、萬顯示。 */
export function formatTwd(v: Num, digits = 2): string {
  if (isMissing(v)) return EMPTY;
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${formatNumber(v / 1e12, digits)} 兆`;
  if (abs >= 1e8) return `${formatNumber(v / 1e8, digits)} 億`;
  if (abs >= 1e4) return `${formatNumber(v / 1e4, digits)} 萬`;
  return formatNumber(v, 0);
}

/** 「2026Q2」這類季別標籤。 */
export function formatQuarter(year: number, quarter: number): string {
  return `${year}Q${quarter}`;
}
