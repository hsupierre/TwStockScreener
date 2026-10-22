"use client";

import { SlidersHorizontal } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { activeRanges, applyFilters, sortRows } from "@/lib/screener/filters";
import { PRESETS } from "@/lib/screener/presets";
import { matchPreset } from "@/lib/screener/search-params";
import type { StockRow } from "@/lib/screener/types";

import { FilterPanel } from "./filter-panel";
import { ResultsTable } from "./results-table";
import { ColumnPicker, ExportButton, PresetBar, ResultCount } from "./toolbar";
import { useScreenerState } from "./use-screener-state";

interface ScreenerProps {
  rows: readonly StockRow[];
  industries: readonly string[];
}

export function Screener({ rows, industries }: ScreenerProps) {
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

export function ScreenerSkeleton() {
  return (
    <div className="flex gap-6" aria-busy="true" aria-label="載入選股器">
      <div className="hidden w-80 shrink-0 flex-col gap-3 lg:flex">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-muted" />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-3">
        <div className="h-8 w-80 animate-pulse rounded bg-muted" />
        <div className="h-[calc(100dvh-13rem)] min-h-96 animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}
