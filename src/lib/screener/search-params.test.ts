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
  describeScreenQuery,
  sameScreenQuery,
  screenQuery,
  screenQueryHref,
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

describe("我的策略的查詢字串", () => {
  it("screenQuery 只保留選股器的參數，維持原本的寫法", () => {
    expect(screenQuery("?dy=4~&utm_source=x&roe=8~&ind=%E5%8D%8A%E5%B0%8E%E9%AB%94%E6%A5%AD")).toBe(
      "dy=4~&roe=8~&ind=%E5%8D%8A%E5%B0%8E%E9%AB%94%E6%A5%AD",
    );
    expect(screenQuery("")).toBe("");
    expect(screenQuery("?broken&%E0=1&q=台積")).toBe("q=台積");
  });

  it("sameScreenQuery 忽略順序與編碼差異", () => {
    expect(sameScreenQuery("dy=4~&roe=8~", "roe=8%7E&dy=4%7E")).toBe(true);
    expect(sameScreenQuery("dy=4~", "dy=5~")).toBe(false);
    expect(sameScreenQuery("", "utm=1")).toBe(true);
  });

  it("describeScreenQuery 轉成條列文字", () => {
    expect(describeScreenQuery("q=台積&m=twse&dy=4~&pe=~15&roe=8~20&ind=半導體業,光電業")).toEqual([
      "搜尋「台積」",
      "上市",
      "半導體業、光電業",
      "本益比 ≤ 15倍",
      "殖利率 ≥ 4%",
      "ROE 8～20%",
    ]);
    expect(describeScreenQuery("ind=a,b,c&dy=abc")).toEqual(["3 個產業"]);
    expect(screenQueryHref("")).toBe("/screener");
    expect(screenQueryHref("dy=4~")).toBe("/screener?dy=4~");
  });
});
