import type { Metadata } from "next";

import { DataFreshness } from "@/components/screener/data-freshness";
import { WatchlistView } from "@/components/member/watchlist-view";
import { getSnapshot } from "@/lib/data/snapshot";
import { packRows } from "@/lib/screener/codec";

export const metadata: Metadata = {
  title: "自選股",
  robots: { index: false },
};

/** 頁面與選股器一樣是靜態的（快照來自快取）；自選清單在瀏覽器端讀取。 */
export default async function WatchlistPage() {
  const { rows, industries, freshness } = await getSnapshot();
  return (
    <div className="mx-auto flex max-w-screen-2xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">自選股</h1>
        <DataFreshness items={freshness} />
      </div>
      <WatchlistView snapshot={packRows(rows, industries)} />
    </div>
  );
}
