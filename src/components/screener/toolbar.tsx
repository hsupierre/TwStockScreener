"use client";

import { Columns3, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { csvFilename, toCsv } from "@/lib/screener/csv";
import { DEFAULT_COLUMNS, METRIC_GROUPS, METRICS, type MetricKey } from "@/lib/screener/metrics";
import { PRESETS, type Preset } from "@/lib/screener/presets";
import type { StockRow } from "@/lib/screener/types";
import { cn } from "@/lib/utils";

export function PresetBar({ active, onApply }: { active: Preset | undefined; onApply: (p: Preset) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="策略模板">
      <span className="text-sm text-muted-foreground">策略模板</span>
      {PRESETS.map((p) => (
        <Tooltip key={p.id}>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant={active?.id === p.id ? "default" : "outline"}
              aria-pressed={active?.id === p.id}
              onClick={() => onApply(p)}
            >
              {p.name}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{p.description}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

export function ColumnPicker({
  value,
  onChange,
}: {
  value: MetricKey[];
  onChange: (cols: MetricKey[]) => void;
}) {
  const selected = new Set(value);
  const toggle = (key: MetricKey, checked: boolean) =>
    // 依指標定義的順序排列，欄位順序才穩定
    onChange(METRICS.map((m) => m.key).filter((k) => (k === key ? checked : selected.has(k))));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns3 aria-hidden />
          顯示欄位
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70vh] w-56 overflow-y-auto">
        {METRIC_GROUPS.map((g, i) => (
          <div key={g.id}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs text-muted-foreground">{g.label}</DropdownMenuLabel>
            {METRICS.filter((m) => m.group === g.id).map((m) => (
              <DropdownMenuCheckboxItem
                key={m.key}
                checked={selected.has(m.key)}
                onCheckedChange={(c) => toggle(m.key, c === true)}
                onSelect={(e) => e.preventDefault()}
              >
                {m.label}
              </DropdownMenuCheckboxItem>
            ))}
          </div>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onChange(DEFAULT_COLUMNS)}>還原預設欄位</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ExportButton({
  rows,
  columns,
}: {
  rows: readonly StockRow[];
  columns: readonly MetricKey[];
}) {
  function download() {
    const blob = new Blob([toCsv(rows, columns)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = csvFilename();
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Button variant="outline" size="sm" onClick={download} disabled={rows.length === 0}>
      <Download aria-hidden />
      匯出 CSV
    </Button>
  );
}

export function ResultCount({
  count,
  total,
  className,
}: {
  count: number;
  total: number;
  className?: string;
}) {
  return (
    <p className={cn("text-sm", className)} aria-live="polite">
      符合條件 <strong className="tabular text-base">{count.toLocaleString("zh-TW")}</strong> 檔
      <span className="text-muted-foreground">／共 {total.toLocaleString("zh-TW")} 檔</span>
    </p>
  );
}
