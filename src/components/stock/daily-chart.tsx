"use client";

import { CandlestickChart, LogIn } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { loginHref } from "@/lib/auth/redirect";
import { useAuth } from "@/lib/auth/session";
import { type Candle, toCandles } from "@/lib/stock/candles";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { CandleChart } from "./lazy-charts";

/** 多讀一些天數，讓 60 日均線從圖表的第一天就有值。 */
const FETCH_DAYS = 250;
const DISPLAY_DAYS = 120;

/** 讀取結果連同它對應的請求（代號、使用者、第幾次重試）一起保存；請求改變時自然就是「讀取中」。 */
type Result = { key: string } & ({ status: "error" } | { status: "ready"; candles: Candle[] });

/**
 * 日 K 線圖（會員限定）。個股頁本身是靜態的；登入後才在瀏覽器端讀取 daily_prices，
 * 資料庫只開放 daily_prices／daily_valuation 給登入會員（RLS），未登入時讀不到。
 */
export function DailyChart({ code }: { code: string }) {
  const auth = useAuth();
  const pathname = usePathname();
  const userId = auth.status === "signedIn" ? auth.member.id : null;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const key = `${code}:${userId}:${attempt}`;
  const state = result?.key === key ? result : ({ status: "loading" } as const);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void createSupabaseBrowserClient()
      .from("daily_prices")
      .select("trade_date, open, high, low, close, change, volume, ex_kind, ex_value, ex_reference_price")
      .eq("code", code)
      .order("trade_date", { ascending: false })
      .limit(FETCH_DAYS)
      .then(({ data, error }) => {
        if (cancelled) return;
        setResult(
          error || !data
            ? { key, status: "error" }
            : { key, status: "ready", candles: toCandles(data).slice(-DISPLAY_DAYS) },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [code, userId, key]);

  if (auth.status === "signedOut") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-dashed px-4 py-12 text-center">
        <CandlestickChart className="size-8 text-muted-foreground" aria-hidden />
        <p className="font-medium">日 K 線圖是會員功能</p>
        <p className="text-sm text-muted-foreground">用 Google 帳號免費登入，就能看 K 線、均線與成交量。</p>
        <Button asChild>
          <Link href={loginHref(pathname) as Route}>
            <LogIn aria-hidden />
            登入看 K 線圖
          </Link>
        </Button>
      </div>
    );
  }
  if (auth.status === "loading" || state.status === "loading") {
    return <div className="h-[25rem] w-full animate-pulse rounded-md bg-muted" aria-label="K 線圖載入中" />;
  }
  if (state.status === "error") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border px-4 py-12 text-center" role="alert">
        <p className="font-medium">K 線圖讀取失敗</p>
        <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
          重試
        </Button>
      </div>
    );
  }
  if (state.candles.length === 0) {
    return (
      <p className="rounded-md border px-4 py-12 text-center text-muted-foreground">還沒有每日行情資料。</p>
    );
  }
  return <CandleChart data={state.candles} />;
}
