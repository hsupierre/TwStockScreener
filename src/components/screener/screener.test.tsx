import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import type { ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { packRows } from "@/lib/screener/codec";
import { makeRow } from "@/lib/screener/test-utils";

import { Screener, ScreenerPreview } from "./screener";

const rows = [
  makeRow({
    code: "2330",
    name: "台積電",
    industry: "半導體業",
    pe: 28,
    dividend_yield: 0.9,
    market_cap: 6e13,
  }),
  makeRow({
    code: "1101",
    name: "台泥",
    industry: "水泥工業",
    pe: 10,
    pb: 1.0,
    roe_ttm: 9,
    market_cap: 2e11,
  }),
  makeRow({
    code: "2884",
    name: "玉山金",
    industry: "金融保險業",
    pe: 11,
    pb: 1.4,
    roe_ttm: 10,
    market_cap: 5e11,
  }),
  makeRow({ code: "6488", name: "環球晶", market: "tpex", industry: "半導體業", pe: 41, market_cap: 4e11 }),
];

// jsdom 不做版面計算；TanStack Virtual 依捲動容器的 clientHeight 決定要渲染幾列
beforeAll(() => {
  vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(800);
  vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(1024);
});

function renderScreener(searchParams = "", onUrlUpdate?: (e: UrlUpdateEvent) => void) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate} hasMemory>
      <TooltipProvider>{children}</TooltipProvider>
    </NuqsTestingAdapter>
  );
  return render(<Screener snapshot={packRows(rows, ["半導體業", "水泥工業", "金融保險業"])} />, { wrapper });
}

const bodyCodes = () =>
  within(screen.getByRole("table"))
    .getAllByRole("rowheader")
    .map((th) => th.textContent?.slice(0, 4));

describe("Screener", () => {
  it("預設依市值由大到小列出全部股票", () => {
    renderScreener();
    expect(screen.getByText(/符合條件/)).toHaveTextContent("符合條件 4 檔／共 4 檔");
    expect(bodyCodes()).toEqual(["2330", "2884", "6488", "1101"]);
  });

  it("從網址還原條件與排序", () => {
    renderScreener("?pe=~12&s=pe.asc");
    expect(screen.getByText(/符合條件/)).toHaveTextContent("符合條件 2 檔");
    expect(bodyCodes()).toEqual(["1101", "2884"]);
    expect(screen.getAllByLabelText("本益比最大值")[0]).toHaveValue("12");
  });

  it("套用策略模板會更新網址、結果與按鈕狀態", async () => {
    const onUrlUpdate = vi.fn<(e: UrlUpdateEvent) => void>();
    renderScreener("", onUrlUpdate);
    await userEvent.click(screen.getByRole("button", { name: "價值" }));

    expect(screen.getByText(/符合條件/)).toHaveTextContent("符合條件 2 檔");
    expect(screen.getByRole("button", { name: "價值" })).toHaveAttribute("aria-pressed", "true");
    const last = onUrlUpdate.mock.calls.at(-1)![0];
    expect(last.searchParams.get("pe")).toBe("~12");
    expect(last.searchParams.get("s")).toBe("pe.asc");
  });

  it("輸入條件即時篩選，輸入到一半的數字不會送出", async () => {
    const onUrlUpdate = vi.fn<(e: UrlUpdateEvent) => void>();
    renderScreener("", onUrlUpdate);
    const input = screen.getAllByLabelText("本益比最小值")[0]!;
    await userEvent.type(input, "30.");
    expect(input).toHaveValue("30.");
    expect(screen.getByText(/符合條件/)).toHaveTextContent("符合條件 1 檔"); // 只有 6488（41 倍）
    expect(onUrlUpdate.mock.calls.at(-1)![0].searchParams.get("pe")).toBe("30~");
  });

  it("點擊表頭切換排序；本益比這類越低越好的指標先由小到大", async () => {
    renderScreener();
    await userEvent.click(screen.getByRole("button", { name: /本益比/ }));
    expect(bodyCodes()).toEqual(["1101", "2884", "2330", "6488"]);
    await userEvent.click(screen.getByRole("button", { name: /本益比/ }));
    expect(bodyCodes()).toEqual(["6488", "2330", "2884", "1101"]);
  });

  it("沒有結果時顯示提示", () => {
    renderScreener("?pe=~1");
    expect(screen.getByText("沒有符合條件的股票")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /匯出 CSV/ })).toBeDisabled();
  });
});

describe("ScreenerPreview（靜態外殼）", () => {
  it("依市值列出前幾檔、按鈕停用並標示載入中，不需要網址狀態", () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      makeRow({ code: String(1000 + i), name: `股票${i}`, market_cap: i * 1e9 }),
    );
    render(
      <TooltipProvider>
        <ScreenerPreview snapshot={packRows(many, [])} />
      </TooltipProvider>,
    );
    const codes = bodyCodes();
    expect(codes.length).toBeGreaterThan(0);
    expect(codes.length).toBeLessThanOrEqual(30);
    expect(codes[0]).toBe("1039"); // 市值最大
    expect(screen.getByText(/符合條件/)).toHaveTextContent("40 檔");
    expect(screen.getByRole("button", { name: "存股" })).toBeDisabled();
    expect(screen.getByRole("region", { name: "選股結果（載入中）" })).toBeInTheDocument();
  });
});
