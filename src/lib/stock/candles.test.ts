import { describe, expect, it } from "vitest";

import { movingAverage, type PriceRow, toCandles } from "./candles";

const row = (
  date: string,
  o: number | null,
  h: number | null,
  l: number | null,
  c: number | null,
  extra = {},
) =>
  ({
    trade_date: date,
    open: o,
    high: h,
    low: l,
    close: c,
    change: null,
    volume: null,
    ...extra,
  }) as PriceRow;

describe("movingAverage", () => {
  it("資料不足時為 null，之後是最近 n 天的平均", () => {
    expect(movingAverage([1, 2, 3, 4, 5, 6], 5)).toEqual([null, null, null, null, 3, 4]);
    expect(movingAverage([10, 11], 1)).toEqual([10, 11]);
    expect(movingAverage([1, 2], 5)).toEqual([null, null]);
  });
});

describe("toCandles", () => {
  it("依日期排序、略過沒有收盤價的日子、成交量換成張", () => {
    const candles = toCandles([
      row("2026-10-30", 2400, 2420, 2380, 2385, { change: -35, volume: 22_750_400 }),
      row("2026-10-29", 2410, 2430, 2400, 2420, { change: 10 }),
      row("2026-10-28", null, null, null, null),
    ]);
    expect(candles.map((c) => c.date)).toEqual(["2026-10-29", "2026-10-30"]);
    expect(candles[1]).toMatchObject({
      label: "10/30",
      open: 2400,
      high: 2420,
      low: 2380,
      close: 2385,
      range: [2380, 2420],
      lots: 22_750,
      trend: "down",
    });
    expect(candles[0]!.trend).toBe("up");
    expect(candles[0]!.lots).toBeNull();
  });

  it("開高低缺漏的舊資料以收盤價補上", () => {
    const [c] = toCandles([row("2026-09-08", null, null, null, 100)]);
    expect(c).toMatchObject({ open: 100, high: 100, low: 100, range: [100, 100], trend: "flat" });
  });

  it("帶出除權息資訊", () => {
    const [normal, ex] = toCandles([
      row("2026-09-22", 46.8, 46.8, 45.4, 45.45),
      row("2026-09-23", 40, 40.45, 39, 39.55, {
        change: -1.9,
        ex_kind: "息",
        ex_value: 4,
        ex_reference_price: 41.45,
      }),
    ]);
    expect(normal!.ex).toBeNull();
    expect(ex!.ex).toEqual({ kind: "息", value: 4, referencePrice: 41.45 });
  });

  it("開盤等於收盤時，依漲跌決定顏色", () => {
    const [up, down] = toCandles([
      row("2026-10-01", 50, 51, 49, 50, { change: 0.5 }),
      row("2026-10-02", 50, 51, 49, 50, { change: -0.5 }),
    ]);
    expect([up!.trend, down!.trend]).toEqual(["up", "down"]);
  });

  it("計算 5／20／60 日均線", () => {
    const rows = Array.from({ length: 60 }, (_, i) =>
      row(
        `2026-${String(Math.floor(i / 28) + 8).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`,
        1,
        1,
        1,
        i + 1,
      ),
    );
    const candles = toCandles(rows);
    expect(candles[3]!.ma5).toBeNull();
    expect(candles[4]!.ma5).toBe(3);
    expect(candles[19]!.ma20).toBe(10.5);
    expect(candles[58]!.ma60).toBeNull();
    expect(candles[59]!.ma60).toBe(30.5);
  });
});
