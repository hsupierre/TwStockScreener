"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ResultsTable } from "@/components/screener/results-table";
import { ColumnPicker, ExportButton } from "@/components/screener/toolbar";
import { Button } from "@/components/ui/button";
import { type Sort, sortRows } from "@/lib/screener/filters";
import { DEFAULT_COLUMNS, type MetricKey } from "@/lib/screener/metrics";
import { type PackedSnapshot, unpackRows } from "@/lib/screener/codec";
import { reloadWatchlist, useWatchlist, WATCHLIST_LIMIT } from "@/lib/member/watchlist";

import { MemberGate } from "./member-gate";

const DEFAULT_WATCH_SORT: Sort = { key: "change_pct", desc: true };

export function WatchlistView({ snapshot }: { snapshot: PackedSnapshot }) {
  const watchlist = useWatchlist();
  const all = useMemo(() => unpackRows(snapshot), [snapshot]);
  // 排序與欄位只存在這一頁（不放網址），重新整理會回到預設
  const [sort, setSort] = useState<Sort>(DEFAULT_WATCH_SORT);
  const [columns, setColumns] = useState<MetricKey[]>(DEFAULT_COLUMNS);

  const rows = useMemo(() => {
    const codes = new Set(watchlist.data);
    return sortRows(
      all.filter((r) => codes.has(r.code)),
      sort,
    );
  }, [all, watchlist.data, sort]);
  // 已下市等原因不在快照裡的代號
  const missing = watchlist.data.length - rows.length;

  return (
    <MemberGate status={watchlist.status} onRetry={reloadWatchlist} what="自選股">
      {watchlist.data.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border px-4 py-16 text-center">
          <Star className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">還沒有自選股</p>
          <p className="text-sm text-muted-foreground">在選股結果或個股頁按 ☆，就會加入這裡。</p>
          <Button asChild>
            <Link href="/screener">開始選股</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">
              共 <strong className="tabular text-base">{watchlist.data.length}</strong> 檔
              <span className="text-muted-foreground">（上限 {WATCHLIST_LIMIT} 檔）</span>
              {missing > 0 && <span className="ml-2 text-muted-foreground">{missing} 檔已無資料</span>}
            </p>
            <div className="flex items-center gap-2">
              <ColumnPicker value={columns} onChange={setColumns} />
              <ExportButton rows={rows} columns={columns} />
            </div>
          </div>
          <ResultsTable rows={rows} columns={columns} sort={sort} onSort={setSort} />
        </div>
      )}
    </MemberGate>
  );
}
