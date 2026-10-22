import { describe, expect, it } from "vitest";

import { METRICS } from "./metrics";
import { PRESETS } from "./presets";
import {
  DEFAULT_SORT,
  matchPreset,
  parseAsRange,
  parseAsSort,
  presetHref,
  presetToState,
  rangesToState,
  screenerHref,
  stateToFilters,
} from "./search-params";

describe("parseAsRange", () => {
  it.each([
    ["4~", { min: 4, max: null }],
    ["~15", { min: null, max: 15 }],
    ["-10~20.5", { min: -10, max: 20.5 }],
    ["20~10", { min: 10, max: 20 }], // 顛倒時自動交換
  ])("解析 %s", (raw, expected) => expect(parseAsRange.parse(raw)).toEqual(expected));

  it.each(["", "~", "4", "abc~", "1~2~3", "1e3~"])("拒絕不合法的值 %j", (raw) =>
    expect(parseAsRange.parse(raw)).toBeNull(),
  );

  it("序列化後可以還原", () => {
    for (const r of [
      { min: 4, max: null },
      { min: null, max: 15 },
      { min: -1.5, max: 2 },
    ]) {
      expect(parseAsRange.parse(parseAsRange.serialize(r))).toEqual(r);
    }
  });
});

describe("parseAsSort", () => {
  it("用短參數名稱表示指標", () => {
    expect(parseAsSort.parse("dy.desc")).toEqual({ key: "dividend_yield", desc: true });
    expect(parseAsSort.parse("code.asc")).toEqual({ key: "code", desc: false });
    expect(parseAsSort.serialize({ key: "roe_ttm", desc: false })).toBe("roe.asc");
  });
  it("拒絕未知欄位或方向", () => {
    expect(parseAsSort.parse("unknown.desc")).toBeNull();
    expect(parseAsSort.parse("pe.up")).toBeNull();
  });
});

describe("網址參數", () => {
  it("每個指標的參數名稱都不重複，也不與固定參數衝突", () => {
    const params = METRICS.map((m) => m.param);
    expect(new Set(params).size).toBe(params.length);
    for (const reserved of ["q", "m", "ind", "s", "cols"]) expect(params).not.toContain(reserved);
  });

  it("stateToFilters 只保留有設定的範圍", () => {
    const filters = stateToFilters(
      { q: "台", m: ["twse"], ind: [], s: DEFAULT_SORT, cols: [] },
      { pe: { min: null, max: 15 }, dy: null },
    );
    expect(filters).toEqual({
      q: "台",
      markets: ["twse"],
      industries: [],
      ranges: { pe: { min: null, max: 15 } },
    });
  });

  it("rangesToState 會把未設定的指標設為 null（套用時清除舊條件）", () => {
    const state = rangesToState({ pe: { min: null, max: 12 } });
    expect(Object.keys(state)).toHaveLength(METRICS.length);
    expect(state.pe).toEqual({ min: null, max: 12 });
    expect(state.dy).toBeNull();
  });

  it("presetHref 產生可分享的短網址，且不含預設值", () => {
    const value = PRESETS.find((p) => p.id === "value")!;
    const href = presetHref(value);
    expect(href.startsWith("/screener?")).toBe(true);
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("pe")).toBe("~12");
    expect(params.get("pb")).toBe("~1.5");
    expect(params.get("roe")).toBe("8~");
    expect(params.get("s")).toBe("pe.asc");
    expect(params.has("dy")).toBe(false);
    expect(params.has("q")).toBe(false);
  });

  it("screenerHref 沒有參數時就是 /screener", () => expect(screenerHref()).toBe("/screener"));
});

describe("matchPreset", () => {
  it("條件完全相同才算符合", () => {
    for (const p of PRESETS) {
      expect(matchPreset(p.ranges, PRESETS)?.id).toBe(p.id);
      const state = presetToState(p);
      expect(Object.values(state.ranges).filter(Boolean)).toHaveLength(Object.keys(p.ranges).length);
    }
    const dividend = PRESETS[0]!;
    expect(matchPreset({ ...dividend.ranges, pe: { min: null, max: 10 } }, PRESETS)).toBeUndefined();
    expect(matchPreset({}, PRESETS)).toBeUndefined();
  });
});
