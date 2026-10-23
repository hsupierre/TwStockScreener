import { describe, expect, it } from "vitest";

import { EMPTY, formatNumber, formatPercent, formatQuarter, formatTwd, formatYi } from "./format";

describe("formatNumber", () => {
  it("加千分位與固定小數", () => {
    expect(formatNumber(2420)).toBe("2,420.00");
    expect(formatNumber(49.333, 1)).toBe("49.3");
  });
  it("缺值顯示為 —", () => {
    expect(formatNumber(null)).toBe(EMPTY);
    expect(formatNumber(undefined)).toBe(EMPTY);
    expect(formatNumber(Number.NaN)).toBe(EMPTY);
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe(EMPTY);
  });
});

describe("formatPercent", () => {
  it("一般與帶正負號", () => {
    expect(formatPercent(12.345)).toBe("12.35%");
    expect(formatPercent(5, 1, { signed: true })).toBe("+5.0%");
    expect(formatPercent(-5, 1, { signed: true })).toBe("-5.0%");
    expect(formatPercent(0, 1, { signed: true })).toBe("0.0%");
  });
  it("缺值", () => expect(formatPercent(null)).toBe(EMPTY));
});

describe("formatTwd", () => {
  it("依量級換算單位", () => {
    expect(formatTwd(2.4e12)).toBe("2.40 兆");
    expect(formatTwd(3.5e9)).toBe("35.00 億");
    expect(formatTwd(-1.2e8)).toBe("-1.20 億");
    expect(formatTwd(56_000)).toBe("5.60 萬");
    expect(formatTwd(999)).toBe("999");
  });
  it("缺值", () => expect(formatTwd(undefined)).toBe(EMPTY));
});

describe("formatYi", () => {
  it("固定以億元顯示", () => {
    expect(formatYi(1.27e12)).toBe("12,700.0");
    expect(formatYi(9.8992e11)).toBe("9,899.2");
    expect(formatYi(-3.5e7)).toBe("-0.4");
    expect(formatYi(null)).toBe(EMPTY);
  });
});

describe("formatQuarter", () => {
  it("組出季別標籤", () => expect(formatQuarter(2026, 2)).toBe("2026Q2"));
});
