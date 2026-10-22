import { METRIC_BY_KEY, type MetricKey } from "./metrics";
import { MARKET_LABELS, type Market, type StockRow } from "./types";

function escape(value: string | number | null): string {
  if (value === null) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * 匯出 CSV：保留原始數值（不加千分位、不換算單位），方便在 Excel 進一步分析。
 * 開頭加上 UTF-8 BOM，Excel 才能正確顯示中文。
 */
export function toCsv(rows: readonly StockRow[], columns: readonly MetricKey[]): string {
  const header = ["代號", "名稱", "市場", "產業", ...columns.map((k) => `${METRIC_BY_KEY[k].label}`)];
  const lines = rows.map((r) =>
    [r.code, r.name, MARKET_LABELS[r.market as Market] ?? r.market, r.industry, ...columns.map((k) => r[k])]
      .map(escape)
      .join(","),
  );
  return "﻿" + [header.map(escape).join(","), ...lines].join("\r\n") + "\r\n";
}

export function csvFilename(date: Date = new Date()): string {
  const ymd = date.toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" }).replaceAll("-", "");
  return `台股選股_${ymd}.csv`;
}
