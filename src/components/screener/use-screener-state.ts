"use client";

import { useQueryStates } from "nuqs";
import { useCallback, useMemo } from "react";

import type { Range, Sort } from "@/lib/screener/filters";
import { METRIC_BY_KEY, type MetricKey } from "@/lib/screener/metrics";
import type { Preset } from "@/lib/screener/presets";
import {
  baseParsers,
  columnsToState,
  presetToState,
  rangeParsers,
  rangesToState,
  stateToColumns,
  stateToFilters,
} from "@/lib/screener/search-params";
import type { Market } from "@/lib/screener/types";

const OPTIONS = { history: "replace" } as const;

/** 選股器的所有狀態都存在網址上（shallow 更新，不會觸發伺服器請求）。 */
export function useScreenerState() {
  const [base, setBase] = useQueryStates(baseParsers, OPTIONS);
  const [ranges, setRanges] = useQueryStates(rangeParsers, OPTIONS);

  const filters = useMemo(() => stateToFilters(base, ranges), [base, ranges]);
  const columns = useMemo(() => stateToColumns(base.cols), [base.cols]);

  const setRange = useCallback(
    (key: MetricKey, range: Range | null) => {
      const empty = !range || (range.min === null && range.max === null);
      void setRanges({ [METRIC_BY_KEY[key].param]: empty ? null : range });
    },
    [setRanges],
  );

  const applyPreset = useCallback(
    (preset: Preset) => {
      const next = presetToState(preset);
      void setBase(next.base);
      void setRanges(next.ranges);
    },
    [setBase, setRanges],
  );

  const resetFilters = useCallback(() => {
    void setBase({ q: null, m: null, ind: null });
    void setRanges(rangesToState({}));
  }, [setBase, setRanges]);

  return {
    filters,
    sort: base.s,
    columns,
    setQuery: useCallback((q: string) => void setBase({ q: q || null }), [setBase]),
    setMarkets: useCallback((m: Market[]) => void setBase({ m: m.length ? m : null }), [setBase]),
    setIndustries: useCallback((ind: string[]) => void setBase({ ind: ind.length ? ind : null }), [setBase]),
    setRange,
    setSort: useCallback((s: Sort) => void setBase({ s }), [setBase]),
    setColumns: useCallback((cols: MetricKey[]) => void setBase({ cols: columnsToState(cols) }), [setBase]),
    applyPreset,
    resetFilters,
  };
}

export type ScreenerController = ReturnType<typeof useScreenerState>;
