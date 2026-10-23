import { formatMetric, trendClass } from "@/lib/screener/display";
import { METRIC_BY_KEY, METRIC_GROUPS, METRICS } from "@/lib/screener/metrics";
import type { StockRow } from "@/lib/screener/types";
import { cn } from "@/lib/utils";

/** 依指標分組列出快照的所有數值，與選股器使用相同的定義與格式。 */
export function KeyMetrics({ snapshot }: { snapshot: StockRow }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {/* 交易類指標顯示在頁首的股價區塊 */}
      {METRIC_GROUPS.filter((g) => g.id !== "trading").map((group) => (
        <section key={group.id} aria-labelledby={`metrics-${group.id}`} className="rounded-lg border p-4">
          <h3 id={`metrics-${group.id}`} className="mb-3 text-sm font-medium text-muted-foreground">
            {group.label}
          </h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            {METRICS.filter((m) => m.group === group.id).map((m) => (
              <div key={m.key} title={m.description}>
                <dt className="text-xs text-muted-foreground">{m.label}</dt>
                <dd className={cn("tabular text-lg font-semibold", trendClass(m, snapshot[m.key]))}>
                  {formatMetric(METRIC_BY_KEY[m.key], snapshot[m.key])}
                  {m.format === "count" && snapshot[m.key] !== null && (
                    <span className="ml-0.5 text-xs font-normal text-muted-foreground">{m.unit}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
