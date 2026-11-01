import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Candle } from "@/lib/stock/candles";
import { fake } from "@/test/fake-supabase";
import { navigationState } from "@/test/navigation";

import { DailyChart } from "./daily-chart";

// Recharts 在 jsdom 沒有尺寸，改成列出收到的資料
vi.mock("./lazy-charts", () => ({
  CandleChart: ({ data }: { data: Candle[] }) => (
    <p>
      K 線 {data.length} 天，最後一天 {data.at(-1)?.date} 收 {data.at(-1)?.close}
    </p>
  ),
}));

const price = (code: string, date: string, close: number) => ({
  code,
  trade_date: date,
  open: close,
  high: close,
  low: close,
  close,
  change: 0,
  volume: 1_000_000,
});

describe("DailyChart", () => {
  it("未登入時顯示登入提示，不讀取資料", async () => {
    navigationState.pathname = "/stocks/2330";
    render(<DailyChart code="2330" />);
    expect(await screen.findByText("日 K 線圖是會員功能")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "登入看 K 線圖" })).toHaveAttribute(
      "href",
      "/login?next=%2Fstocks%2F2330",
    );
  });

  it("登入後讀取這檔股票的每日行情，依日期由舊到新畫出", async () => {
    fake.session = { user: { id: "alice", user_metadata: {} } } as never;
    fake.tables.daily_prices = [
      price("2330", "2026-10-29", 2420),
      price("2330", "2026-10-30", 2385),
      price("2317", "2026-10-30", 245),
    ];
    render(<DailyChart code="2330" />);
    expect(await screen.findByText("K 線 2 天，最後一天 2026-10-30 收 2385")).toBeInTheDocument();
  });

  it("讀取失敗可以重試", async () => {
    fake.session = { user: { id: "alice", user_metadata: {} } } as never;
    fake.tables.daily_prices = [price("2330", "2026-10-30", 2385)];
    fake.nextError = { message: "timeout" };
    const user = userEvent.setup();
    render(<DailyChart code="2330" />);
    await user.click(await screen.findByRole("button", { name: "重試" }));
    expect(await screen.findByText(/K 線 1 天/)).toBeInTheDocument();
  });

  it("沒有資料時顯示提示", async () => {
    fake.session = { user: { id: "alice", user_metadata: {} } } as never;
    render(<DailyChart code="9999" />);
    expect(await screen.findByText("還沒有每日行情資料。")).toBeInTheDocument();
  });
});
