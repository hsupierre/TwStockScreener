"use client";

import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { activeRanges } from "@/lib/screener/filters";
import { METRIC_GROUPS, METRICS } from "@/lib/screener/metrics";
import { MARKET_LABELS, MARKETS, type Market } from "@/lib/screener/types";

import { IndustryFilter } from "./industry-filter";
import { RangeFilter } from "./range-filter";
import type { ScreenerController } from "./use-screener-state";

interface FilterPanelProps {
  controller: ScreenerController;
  industries: readonly string[];
}

export function FilterPanel({ controller, industries }: FilterPanelProps) {
  const { filters } = controller;
  const activeCount =
    activeRanges(filters.ranges).length +
    (filters.markets.length > 0 ? 1 : 0) +
    (filters.industries.length > 0 ? 1 : 0) +
    (filters.q ? 1 : 0);

  return (
    <div className="flex flex-col gap-5" role="search" aria-label="篩選條件">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">
          篩選條件
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeCount}
            </Badge>
          )}
        </h2>
        <Button variant="ghost" size="sm" onClick={controller.resetFilters} disabled={activeCount === 0}>
          全部清除
        </Button>
      </div>

      <div className="relative">
        <Search
          className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          placeholder="代號或名稱，例如 2330、台積"
          aria-label="搜尋股票代號或名稱"
          value={filters.q}
          onChange={(e) => controller.setQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm text-muted-foreground">市場與產業</span>
        <ToggleGroup
          type="multiple"
          variant="outline"
          value={filters.markets}
          onValueChange={(v) => controller.setMarkets(v as Market[])}
          aria-label="市場"
          className="w-full"
        >
          {MARKETS.map((m) => (
            <ToggleGroupItem key={m} value={m} className="flex-1">
              {MARKET_LABELS[m]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <IndustryFilter
          industries={industries}
          value={filters.industries}
          onChange={controller.setIndustries}
        />
      </div>

      {METRIC_GROUPS.map((group) => (
        <fieldset key={group.id} className="flex flex-col gap-2">
          <legend className="mb-1 text-sm text-muted-foreground">{group.label}</legend>
          {METRICS.filter((m) => m.group === group.id).map((m) => (
            <RangeFilter
              key={m.key}
              metric={m}
              value={filters.ranges[m.key]}
              onChange={(r) => controller.setRange(m.key, r)}
            />
          ))}
        </fieldset>
      ))}

      <p className="text-xs text-muted-foreground">
        設定條件後，沒有該項資料的股票（例如金融業沒有毛利率）會被排除。
      </p>
    </div>
  );
}
