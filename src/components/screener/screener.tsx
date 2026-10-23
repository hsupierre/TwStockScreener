"use client";

import { SlidersHorizontal } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { activeRanges, applyFilters, sortRows } from "@/lib/screener/filters";
import { PRESETS } from "@/lib/screener/presets";
import { DEFAULT_COLUMNS } from "@/lib/screener/metrics";
import { DEFAULT_SORT, matchPreset } from "@/lib/screener/search-params";
import { type PackedSnapshot, unpackRows } from "@/lib/screener/codec";

import { FilterPanel } from "./filter-panel";
import { ResultsTable } from "./results-table";
import { ColumnPicker, ExportButton, PresetBar, ResultCount } from "./toolbar";
import { useScreenerState } from "./use-screener-state";

interface ScreenerProps {
  /** 伺服器端以 packRows() 壓縮過的快照（見 lib/screener/codec.ts） */
  snapshot: PackedSnapshot;
}

export function Screener({ snapshot }: ScreenerProps) {
  const rows = useMemo(() => unpackRows(snapshot), [snapshot]);
  const industries = snapshot.industries;
  const controller = useScreenerState();
  const { filters, sort, columns } = controller;

  const results = useMemo(() => sortRows(applyFilters(rows, filters), sort), [rows, filters, sort]);
  const activePreset = useMemo(() => matchPreset(filters.ranges, PRESETS), [filters.ranges]);
  const activeCount = activeRanges(filters.ranges).length;

  return (
    <div className="flex gap-6">
      <aside className="hidden w-80 shrink-0 lg:block">
        <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto pr-2 pb-4">
          <FilterPanel controller={controller} industries={industries} />
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col gap-3" aria-label="選股結果">
        <PresetBar active={activePreset} onApply={controller.applyPreset} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ResultCount count={results.length} total={rows.length} />
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden">
                  <SlidersHorizontal aria-hidden />
                  篩選
                  {activeCount > 0 && <Badge variant="secondary">{activeCount}</Badge>}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[22rem] max-w-[90vw] overflow-y-auto">
                <SheetHeader className="sr-only">
                  <SheetTitle>篩選條件</SheetTitle>
                </SheetHeader>
                <div className="p-4 pt-12">
                  <FilterPanel controller={controller} industries={industries} />
                </div>
              </SheetContent>
            </Sheet>
            <ColumnPicker value={columns} onChange={controller.setColumns} />
            <ExportButton rows={results} columns={columns} />
          </div>
        </div>
        <ResultsTable rows={results} columns={columns} sort={sort} onSort={controller.setSort} />
      </section>
    </div>
  );
}

const PREVIEW_ROWS = 30;
const noop = () => {};

/**
 * 靜態外殼裡的預覽：依市值排序的前 30 檔、預設欄位，版面與選股器完全相同。
 * 讓表格直接出現在 HTML（LCP 不必等 JavaScript、搜尋引擎看得到清單），hydration 後也不會跳動。
 * 網址帶有篩選條件時，載入完成前會短暫顯示這份預設清單，所以標示為載入中並稍微淡化。
 */
export function ScreenerPreview({ snapshot }: ScreenerProps) {
  const rows = useMemo(() => unpackRows(snapshot), [snapshot]);
  const preview = useMemo(() => sortRows(rows, DEFAULT_SORT).slice(0, PREVIEW_ROWS), [rows]);
  return (
    <div className="flex gap-6" aria-busy="true">
      <aside className="hidden w-80 shrink-0 flex-col gap-3 lg:flex" aria-hidden>
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-muted" />
        ))}
      </aside>
      <section className="flex min-w-0 flex-1 flex-col gap-3 opacity-70" aria-label="選股結果（載入中）">
        <PresetBar active={undefined} onApply={noop} disabled />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ResultCount count={rows.length} total={rows.length} />
          <div className="h-8 w-72 animate-pulse rounded bg-muted" />
        </div>
        <ResultsTable rows={preview} columns={DEFAULT_COLUMNS} sort={DEFAULT_SORT} onSort={noop} />
      </section>
    </div>
  );
}
