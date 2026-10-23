import { describe, expect, it } from "vitest";

import { activeRanges, applyFilters, EMPTY_FILTERS, inRange, sortRows } from "./filters";
import { makeRow } from "./test-utils";

const rows = [
  makeRow({
    code: "2330",
    name: "台積電",
    industry: "半導體業",
    pe: 28,
    dividend_yield: 0.9,
    market_cap: 6.2e13,
  }),
  makeRow({
    code: "2881",
    name: "富邦金",
    industry: "金融保險業",
    pe: 14.8,
    dividend_yield: 2.7,
    gross_margin: null,
  }),
  makeRow({
    code: "6488",
    name: "環球晶",
    market: "tpex",
    industry: "半導體業",
    pe: 41,
    dividend_yield: 0.9,
  }),
  makeRow({
    code: "1101",
    name: "台泥",
    industry: "水泥工業",
    pe: null,
    dividend_yield: 4.5,
    market_cap: 2e11,
  }),
];

const codes = (rs: { code: string }[]) => rs.map((r) => r.code);

describe("inRange", () => {
  it("包含邊界", () => {
    expect(inRange(10, { min: 10, max: 20 })).toBe(true);
    expect(inRange(20, { min: 10, max: 20 })).toBe(true);
    expect(inRange(9.99, { min: 10, max: null })).toBe(false);
  });
  it("缺值一律不符合", () => expect(inRange(null, { min: null, max: 100 })).toBe(false));
  it("成交量以張輸入（1 張 = 1,000 股）", () => {
    expect(inRange(883_284, { min: 500, max: null }, 1000)).toBe(true);
    expect(inRange(883_284, { min: 1000, max: null }, 1000)).toBe(false);
  });
  it("依 scale 換算單位（市值以億輸入）", () => {
    expect(inRange(2e11, { min: 1000, max: 3000 }, 1e8)).toBe(true);
    expect(inRange(2e11, { min: 3000, max: null }, 1e8)).toBe(false);
  });
});

describe("applyFilters", () => {
  it("沒有條件時回傳全部", () => expect(applyFilters(rows, EMPTY_FILTERS)).toHaveLength(4));

  it("數值範圍：有設定條件但沒有資料的股票會被排除", () => {
    const out = applyFilters(rows, { ...EMPTY_FILTERS, ranges: { pe: { min: null, max: 30 } } });
    expect(codes(out)).toEqual(["2330", "2881"]); // 台泥沒有本益比
  });

  it("多個條件同時成立（AND）", () => {
    const out = applyFilters(rows, {
      ...EMPTY_FILTERS,
      ranges: { pe: { min: null, max: 30 }, dividend_yield: { min: 2, max: null } },
    });
    expect(codes(out)).toEqual(["2881"]);
  });

  it("市場與產業", () => {
    expect(codes(applyFilters(rows, { ...EMPTY_FILTERS, markets: ["tpex"] }))).toEqual(["6488"]);
    expect(codes(applyFilters(rows, { ...EMPTY_FILTERS, industries: ["半導體業", "水泥工業"] }))).toEqual([
      "2330",
      "6488",
      "1101",
    ]);
  });

  it("搜尋：代號開頭或名稱包含", () => {
    expect(codes(applyFilters(rows, { ...EMPTY_FILTERS, q: "23" }))).toEqual(["2330"]);
    expect(codes(applyFilters(rows, { ...EMPTY_FILTERS, q: " 台 " }))).toEqual(["2330", "1101"]);
  });

  it("空範圍不算條件", () => {
    expect(activeRanges({ pe: { min: null, max: null }, pb: { min: 1, max: null } })).toEqual([
      ["pb", { min: 1, max: null }],
    ]);
  });
});

describe("sortRows", () => {
  it("降冪，缺值排最後", () => {
    expect(codes(sortRows(rows, { key: "pe", desc: true }))).toEqual(["6488", "2330", "2881", "1101"]);
  });
  it("升冪，缺值仍排最後", () => {
    expect(codes(sortRows(rows, { key: "pe", desc: false }))).toEqual(["2881", "2330", "6488", "1101"]);
  });
  it("數值相同時依代號排序，結果穩定", () => {
    expect(codes(sortRows(rows, { key: "dividend_yield", desc: true }))).toEqual([
      "1101",
      "2881",
      "2330",
      "6488",
    ]);
  });
  it("依代號排序，且不改變原陣列", () => {
    const copy = [...rows];
    expect(codes(sortRows(rows, { key: "code", desc: false }))).toEqual(["1101", "2330", "2881", "6488"]);
    expect(rows).toEqual(copy);
  });
});
