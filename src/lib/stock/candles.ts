/** 日 K 線圖的資料轉換（純函式，方便測試）。 */

export interface PriceRow {
  trade_date: string | null;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  change: number | null;
  /** 股數，已扣除零股與鉅額交易（daily_prices view） */
  volume: number | null;
  /** 除權息日才有：權、息、權息 */
  ex_kind?: string | null;
  /** 權值＋息值（元） */
  ex_value?: number | null;
  ex_reference_price?: number | null;
}

/** 除權息日：價格會依權息值向下調整，K 線因此出現缺口（未還原權值）。 */
export interface ExRights {
  kind: string;
  value: number | null;
  referencePrice: number | null;
}

export type Trend = "up" | "down" | "flat";

export interface Candle {
  date: string;
  /** X 軸標籤，例如 10/30 */
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number | null;
  /** 張（1,000 股） */
  lots: number | null;
  /** Recharts 區間長條用的 [最低, 最高] */
  range: [number, number];
  /** K 棒顏色：收盤高於開盤為紅（漲）、低於開盤為綠（跌）；相同時看漲跌 */
  trend: Trend;
  ma5: number | null;
  ma20: number | null;
  ma60: number | null;
  ex: ExRights | null;
}

export const MA_PERIODS = [5, 20, 60] as const;

function trendOf(open: number, close: number, change: number | null): Trend {
  if (close > open) return "up";
  if (close < open) return "down";
  if (change && change > 0) return "up";
  if (change && change < 0) return "down";
  return "flat";
}

/** 收盤價的簡單移動平均；資料不足 n 天時為 null。 */
export function movingAverage(closes: readonly number[], n: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  closes.forEach((c, i) => {
    sum += c;
    if (i >= n) sum -= closes[i - n]!;
    out.push(i >= n - 1 ? Math.round((sum / n) * 100) / 100 : null);
  });
  return out;
}

/**
 * 依日期排序並轉成 K 棒。沒有收盤價的日子略過；
 * 開高低缺漏時（新增欄位前的舊資料）以收盤價補上，畫成一條橫線。
 */
export function toCandles(rows: readonly PriceRow[]): Candle[] {
  const valid = rows
    .filter((r): r is PriceRow & { trade_date: string; close: number } => !!r.trade_date && r.close !== null)
    .sort((a, b) => a.trade_date.localeCompare(b.trade_date));
  const closes = valid.map((r) => r.close);
  const mas = Object.fromEntries(MA_PERIODS.map((n) => [n, movingAverage(closes, n)]));

  return valid.map((r, i) => {
    const open = r.open ?? r.close;
    const high = Math.max(r.high ?? r.close, open, r.close);
    const low = Math.min(r.low ?? r.close, open, r.close);
    const [, month, day] = r.trade_date.split("-");
    return {
      date: r.trade_date,
      label: `${Number(month)}/${Number(day)}`,
      open,
      high,
      low,
      close: r.close,
      change: r.change,
      lots: r.volume === null ? null : Math.round(r.volume / 1000),
      range: [low, high],
      trend: trendOf(open, r.close, r.change),
      ma5: mas[5]![i]!,
      ma20: mas[20]![i]!,
      ma60: mas[60]![i]!,
      ex: r.ex_kind
        ? { kind: r.ex_kind, value: r.ex_value ?? null, referencePrice: r.ex_reference_price ?? null }
        : null,
    };
  });
}
