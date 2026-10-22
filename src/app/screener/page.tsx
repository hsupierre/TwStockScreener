import type { Metadata } from "next";
import { Suspense } from "react";

import { DataFreshness } from "@/components/screener/data-freshness";
import { Screener, ScreenerSkeleton } from "@/components/screener/screener";
import { getSnapshot } from "@/lib/data/snapshot";

export const metadata: Metadata = {
  title: "選股",
  description: "用本益比、殖利率、ROE、毛利率、營收成長、負債比等條件篩選上市櫃股票，條件可存成網址分享。",
};

export default async function ScreenerPage() {
  const { rows, industries, freshness } = await getSnapshot();
  return (
    <div className="mx-auto flex max-w-screen-2xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">台股選股</h1>
        <DataFreshness items={freshness} />
      </div>
      {/* 選股器讀取網址參數，必須在 Suspense 內，靜態外殼先顯示骨架 */}
      <Suspense fallback={<ScreenerSkeleton />}>
        <Screener rows={rows} industries={industries} />
      </Suspense>
    </div>
  );
}
