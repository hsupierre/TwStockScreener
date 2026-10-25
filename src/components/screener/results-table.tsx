"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRef } from "react";

import { WatchStar } from "@/components/member/watch-button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatMetric, trendClass } from "@/lib/screener/display";
import type { Sort, SortKey } from "@/lib/screener/filters";
import { METRIC_BY_KEY, type MetricKey } from "@/lib/screener/metrics";
import { MARKET_LABELS, type Market, type ScreenerRow } from "@/lib/screener/types";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 40;
/** 數值越低越好的指標，第一次點擊時先由小排到大。 */
const ASC_FIRST = new Set<SortKey>(["code", "pe", "pb", "debt_ratio"]);

interface ResultsTableProps {
  rows: readonly ScreenerRow[];
  columns: readonly MetricKey[];
  sort: Sort;
  onSort: (sort: Sort) => void;
}

export function ResultsTable({ rows, columns, sort, onSort }: ResultsTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // React Compiler 會略過這個元件的自動 memo（TanStack Virtual 回傳的函式不能 memo），行為不受影響
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    initialRect: { width: 1024, height: 640 },
  });
  const items = virtualizer.getVirtualItems();
  const paddingTop = items[0]?.start ?? 0;
  const paddingBottom = virtualizer.getTotalSize() - (items.at(-1)?.end ?? 0);

  const clickSort = (key: SortKey) =>
    onSort(sort.key === key ? { key, desc: !sort.desc } : { key, desc: !ASC_FIRST.has(key) });

  if (rows.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-1 rounded-md border text-center">
        <p className="font-medium">沒有符合條件的股票</p>
        <p className="text-sm text-muted-foreground">試著放寬或移除部分條件。</p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="relative h-[calc(100dvh-13rem)] min-h-96 overflow-auto rounded-md border"
      tabIndex={0}
      aria-label="選股結果（可捲動）"
    >
      <table className="tabular w-full min-w-max border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-20 bg-muted/95 backdrop-blur">
          <tr>
            <SortHeader label="股票" sortKey="code" sort={sort} onClick={clickSort} sticky />
            <th
              scope="col"
              className="hidden border-b px-3 py-2 text-left font-medium whitespace-nowrap md:table-cell"
            >
              產業
            </th>
            {columns.map((key) => (
              <SortHeader
                key={key}
                label={METRIC_BY_KEY[key].label}
                description={METRIC_BY_KEY[key].description}
                sortKey={key}
                sort={sort}
                onClick={clickSort}
                numeric
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {paddingTop > 0 && (
            <tr aria-hidden>
              <td style={{ height: paddingTop }} colSpan={columns.length + 2} />
            </tr>
          )}
          {items.map((item) => {
            const row = rows[item.index]!;
            return (
              <tr key={row.code} className="group hover:bg-muted/50" style={{ height: ROW_HEIGHT }}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 border-b bg-background px-3 text-left font-normal whitespace-nowrap group-hover:bg-muted"
                >
                  <WatchStar code={row.code} name={row.name} />
                  <Link
                    href={`/stocks/${row.code}` as Route}
                    className="hover:underline focus-visible:underline"
                  >
                    <span className="font-mono text-xs text-muted-foreground">{row.code}</span>
                    <span className="ml-2 font-medium">{row.name}</span>
                  </Link>
                  {row.market === "tpex" && (
                    <Badge variant="outline" className="ml-2 px-1 py-0 text-[10px]">
                      {MARKET_LABELS[row.market as Market]}
                    </Badge>
                  )}
                </th>
                <td className="hidden border-b px-3 whitespace-nowrap text-muted-foreground md:table-cell">
                  {row.industry ?? "—"}
                </td>
                {columns.map((key) => {
                  const def = METRIC_BY_KEY[key];
                  return (
                    <td
                      key={key}
                      className={cn("border-b px-3 text-right whitespace-nowrap", trendClass(def, row[key]))}
                    >
                      {formatMetric(def, row[key])}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {paddingBottom > 0 && (
            <tr aria-hidden>
              <td style={{ height: paddingBottom }} colSpan={columns.length + 2} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

interface SortHeaderProps {
  label: string;
  description?: string;
  sortKey: SortKey;
  sort: Sort;
  onClick: (key: SortKey) => void;
  numeric?: boolean;
  sticky?: boolean;
}

function SortHeader({ label, description, sortKey, sort, onClick, numeric, sticky }: SortHeaderProps) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.desc ? ArrowDown : ArrowUp;
  const button = (
    <button
      type="button"
      onClick={() => onClick(sortKey)}
      className={cn(
        "inline-flex items-center gap-1 font-medium hover:text-foreground",
        active ? "text-foreground" : "text-muted-foreground",
        numeric && "flex-row-reverse",
      )}
    >
      {label}
      <Icon className={cn("size-3.5", !active && "opacity-40")} aria-hidden />
    </button>
  );
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}
      className={cn(
        "border-b px-3 py-2 whitespace-nowrap",
        numeric ? "text-right" : "text-left",
        sticky && "sticky left-0 z-30 bg-muted",
      )}
    >
      {description ? (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>{description}</TooltipContent>
        </Tooltip>
      ) : (
        button
      )}
    </th>
  );
}
