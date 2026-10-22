import { describe, expect, it } from "vitest";

import { csvFilename, toCsv } from "./csv";
import { formatMetric, trendClass } from "./display";
import { expectedQuarter, expectedRevenueMonth, freshnessStatus } from "./freshness";
import { METRIC_BY_KEY, METRICS } from "./metrics";
import { PRESETS } from "./presets";
import { makeRow } from "./test-utils";

describe("策略模板", () => {
  it("引用的指標與欄位都存在", () => {
    const keys = new Set(METRICS.map((m) => m.key));
    for (const p of PRESETS) {
      for (const k of Object.keys(p.ranges)) expect(keys).toContain(k);
      for (const k of p.columns) expect(keys).toContain(k);
      expect(p.sort.key === "code" || keys.has(p.sort.key)).toBe(true);
    }
  });
  it("id 不重複", () => expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length));
});

describe("toCsv", () => {
  it("UTF-8 BOM、中文表頭、原始數值與跳脫", () => {
    const csv = toCsv(
      [
        makeRow({ code: "2330", name: "台積電", industry: "半導體業", pe: 28.05, gross_margin: null }),
        makeRow({ code: "9999", name: '測試,"公司"', market: "tpex" }),
      ],
      ["pe", "gross_margin"],
    );
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).trimEnd().split("\r\n");
    expect(lines[0]).toBe("代號,名稱,市場,產業,本益比,毛利率");
    expect(lines[1]).toBe("2330,台積電,上市,半導體業,28.05,");
    expect(lines[2]).toBe('9999,"測試,""公司""",上櫃,,,');
  });
  it("檔名使用台灣日期", () => {
    expect(csvFilename(new Date("2026-10-23T17:00:00Z"))).toBe("台股選股_20261024.csv");
  });
});

describe("formatMetric / trendClass", () => {
  it("依格式顯示", () => {
    expect(formatMetric(METRIC_BY_KEY.pe, 28.054)).toBe("28.05");
    expect(formatMetric(METRIC_BY_KEY.roe_ttm, 40.62)).toBe("40.6%");
    expect(formatMetric(METRIC_BY_KEY.revenue_yoy, 54.64)).toBe("+54.6%");
    expect(formatMetric(METRIC_BY_KEY.market_cap, 6.27e13)).toBe("63 兆");
    expect(formatMetric(METRIC_BY_KEY.dividend_streak_years, 10)).toBe("10");
    expect(formatMetric(METRIC_BY_KEY.gross_margin, null)).toBe("—");
  });
  it("成長類正紅負綠，其他指標不上色", () => {
    expect(trendClass(METRIC_BY_KEY.revenue_yoy, 5)).toBe("text-up");
    expect(trendClass(METRIC_BY_KEY.revenue_yoy, -5)).toBe("text-down");
    expect(trendClass(METRIC_BY_KEY.revenue_yoy, 0)).toBe("");
    expect(trendClass(METRIC_BY_KEY.roe_ttm, 5)).toBe("");
  });
});

describe("資料過期判斷", () => {
  it("月營收：15 日後應該有上個月", () => {
    expect(expectedRevenueMonth(new Date("2026-10-23T04:00:00Z"))).toBe("2026-09");
    expect(expectedRevenueMonth(new Date("2026-10-05T04:00:00Z"))).toBe("2026-08");
    expect(expectedRevenueMonth(new Date("2026-01-20T04:00:00Z"))).toBe("2025-12");
  });

  it("季報：依公告期限加 7 天緩衝", () => {
    expect(expectedQuarter(new Date("2026-10-23T04:00:00Z"))).toBe("2026Q2");
    expect(expectedQuarter(new Date("2026-11-25T04:00:00Z"))).toBe("2026Q3");
    expect(expectedQuarter(new Date("2026-04-01T04:00:00Z"))).toBe("2025Q3");
    expect(expectedQuarter(new Date("2026-04-10T04:00:00Z"))).toBe("2025Q4");
  });

  it("綜合判斷", () => {
    const now = new Date("2026-10-23T04:00:00Z");
    const status = freshnessStatus(
      [
        { job: "daily", asOf: "2026-10-21", finishedAt: "2026-10-22T01:45:00Z" },
        { job: "monthly", asOf: "2026-08", finishedAt: "2026-09-12T13:00:00Z" },
        { job: "quarterly", asOf: "2026Q2", finishedAt: "2026-10-22T16:37:00Z" },
        { job: "dividend", asOf: "2026-10-20", finishedAt: "2026-10-20T15:33:00Z" },
        { job: "snapshot", asOf: "2026-10-21", finishedAt: "2026-10-22T16:37:00Z" },
      ],
      now,
    );
    expect(status.map((s) => [s.job, s.stale])).toEqual([
      ["daily", false],
      ["monthly", true],
      ["quarterly", false],
      ["dividend", false],
    ]);
    const old = freshnessStatus(
      [{ job: "daily", asOf: "2026-10-15", finishedAt: "2026-10-15T15:00:00Z" }],
      now,
    );
    expect(old[0]!.stale).toBe(true);
  });
});
