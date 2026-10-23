import { EMPTY, formatNumber, formatPercent, formatTwd } from "@/lib/format";

import type { MetricDef } from "./metrics";

export function formatMetric(def: MetricDef, value: number | null): string {
  if (value === null || !Number.isFinite(value)) return EMPTY;
  switch (def.format) {
    case "price":
    case "ratio":
    case "dividend":
      return formatNumber(value, 2);
    case "percent":
      return formatPercent(value, 1);
    case "growth":
      return formatPercent(value, 1, { signed: true });
    case "twd":
      return formatTwd(value, 0);
    case "count":
      return String(value);
    case "lots":
      return formatNumber(value / 1000, 0);
  }
}

/** 台股慣例：成長類指標正數紅色、負數綠色。 */
export function trendClass(def: MetricDef, value: number | null): string {
  if (def.format !== "growth" || value === null || value === 0) return "";
  return value > 0 ? "text-up" : "text-down";
}
