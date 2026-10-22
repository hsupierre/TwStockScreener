"use client";

import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import type { Range } from "@/lib/screener/filters";
import type { MetricDef } from "@/lib/screener/metrics";
import { cn } from "@/lib/utils";

const NUM = /^-?\d+(\.\d+)?$/;

/** 空字串 → null；合法數字 → number；輸入到一半（例如 "-"、"1."）→ undefined，暫不送出。 */
function parseText(text: string): number | null | undefined {
  const t = text.trim();
  if (t === "") return null;
  return NUM.test(t) ? Number(t) : undefined;
}

const toText = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

interface RangeFilterProps {
  metric: MetricDef;
  value: Range | undefined;
  onChange: (range: Range | null) => void;
}

export function RangeFilter({ metric, value, onChange }: RangeFilterProps) {
  const id = useId();
  const [minText, setMinText] = useState(toText(value?.min));
  const [maxText, setMaxText] = useState(toText(value?.max));

  // 外部改變（套用策略、清除條件）時同步輸入框；自己輸入造成的變化不會覆蓋使用者正在打的字
  const [synced, setSynced] = useState(value);
  if (synced?.min !== value?.min || synced?.max !== value?.max) {
    setSynced(value);
    if (parseText(minText) !== (value?.min ?? null)) setMinText(toText(value?.min));
    if (parseText(maxText) !== (value?.max ?? null)) setMaxText(toText(value?.max));
  }

  function update(nextMin: string, nextMax: string) {
    setMinText(nextMin);
    setMaxText(nextMax);
    const min = parseText(nextMin);
    const max = parseText(nextMax);
    if (min === undefined || max === undefined) return;
    onChange(min === null && max === null ? null : { min, max });
  }

  const active = value?.min != null || value?.max != null;
  const invalid = (t: string) => parseText(t) === undefined;

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1">
      <label
        htmlFor={`${id}-min`}
        className={cn("truncate text-sm", active && "font-medium text-foreground")}
      >
        {metric.label}
        <span className="ml-1 text-xs text-muted-foreground">{metric.unit}</span>
      </label>
      <div className="flex items-center gap-1">
        <Input
          id={`${id}-min`}
          inputMode="decimal"
          placeholder="最小"
          aria-label={`${metric.label}最小值`}
          aria-invalid={invalid(minText) || undefined}
          value={minText}
          onChange={(e) => update(e.target.value, maxText)}
          className="tabular h-8 w-20 px-2 text-right"
        />
        <span className="text-muted-foreground" aria-hidden>
          ~
        </span>
        <Input
          inputMode="decimal"
          placeholder="最大"
          aria-label={`${metric.label}最大值`}
          aria-invalid={invalid(maxText) || undefined}
          value={maxText}
          onChange={(e) => update(minText, e.target.value)}
          className="tabular h-8 w-20 px-2 text-right"
        />
      </div>
    </div>
  );
}
