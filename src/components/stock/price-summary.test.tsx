import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { makeRow } from "@/lib/screener/test-utils";

import { PriceSummary } from "./price-summary";

const base = { code: "1808", name: "潤隆", price_date: "2026-10-22" };

describe("PriceSummary", () => {
  it("下跌：綠色 ▼、漲跌幅、成交量以張顯示", () => {
    render(
      <PriceSummary
        snapshot={makeRow({
          ...base,
          close: 33.9,
          change: -0.45,
          change_pct: -1.31,
          volume: 883_284,
          trade_value: 30_145_440,
          avg_volume_20d: 1_169_287,
        })}
      />,
    );
    const change = screen.getByLabelText("漲跌");
    expect(change).toHaveTextContent("▼0.45（-1.31%）");
    expect(change).toHaveClass("text-down");
    const info = screen.getByLabelText("成交資訊");
    expect(info).toHaveTextContent("成交量883 張");
    expect(info).toHaveTextContent("成交金額3,014.54 萬");
    expect(info).toHaveTextContent("20 日均量1,169 張");
  });

  it("上漲：紅色 ▲ 並加上正號", () => {
    render(<PriceSummary snapshot={makeRow({ ...base, close: 34.35, change: 0.5, change_pct: 1.48 })} />);
    const change = screen.getByLabelText("漲跌");
    expect(change).toHaveTextContent("▲0.50（+1.48%）");
    expect(change).toHaveClass("text-up");
  });

  it("平盤不顯示箭頭；沒有成交量資料顯示 —", () => {
    render(<PriceSummary snapshot={makeRow({ ...base, close: 34, change: 0, change_pct: 0 })} />);
    expect(screen.getByLabelText("漲跌")).toHaveTextContent(/^0\.00（0\.00%）$/);
    expect(screen.getByLabelText("成交資訊")).toHaveTextContent("20 日均量—");
  });

  it("沒有收盤價時不顯示", () => {
    const { container } = render(<PriceSummary snapshot={makeRow({ ...base, close: null })} />);
    expect(container).toBeEmptyDOMElement();
  });
});
