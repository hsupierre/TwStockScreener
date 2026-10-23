import { describe, expect, it } from "vitest";

import { packRows, unpackRows } from "./codec";
import { METRICS } from "./metrics";
import { makeRow } from "./test-utils";

describe("packRows / unpackRows", () => {
  const rows = [
    makeRow({ code: "2330", name: "台積電", industry: "半導體業", pe: 28.05, market_cap: 6.27e13 }),
    makeRow({ code: "6488", name: "環球晶", market: "tpex", industry: "半導體業", gross_margin: -1.5 }),
    makeRow({ code: "9999", name: "無產業", industry: null }),
    makeRow({ code: "8888", name: "未知產業", industry: "不在清單" }),
  ];
  const industries = ["半導體業", "水泥工業"];

  it("還原後與原本的選股欄位完全相同", () => {
    const out = unpackRows(packRows(rows, industries));
    const pick = (r: (typeof rows)[number]) => ({
      code: r.code,
      name: r.name,
      market: r.market,
      industry: r.industry === "不在清單" ? null : r.industry,
      ...Object.fromEntries(METRICS.map((m) => [m.key, r[m.key]])),
    });
    expect(out).toEqual(rows.map(pick));
  });

  it("每列只包含值，欄位名稱只出現一次", () => {
    const packed = packRows(rows, industries);
    expect(packed.rows[0]!.slice(0, 4)).toEqual(["2330", "台積電", 0, 0]);
    expect(packed.rows[1]![2]).toBe(1); // tpex
    expect(packed.rows[2]![3]).toBe(-1); // 沒有產業
    expect(packed.rows[0]).toHaveLength(4 + METRICS.length);
    expect(JSON.stringify(packed)).not.toContain('market_cap":'); // 只有 metrics 陣列裡的名稱
  });
});
