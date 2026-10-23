import { EMPTY, formatNumber, formatTwd } from "@/lib/format";
import type { StockRow } from "@/lib/screener/types";
import { cn } from "@/lib/utils";

const lots = (shares: number | null) => (shares === null ? EMPTY : `${formatNumber(shares / 1000, 0)} 張`);

/** 收盤價、漲跌（台股慣例紅漲綠跌）與成交量資訊。 */
export function PriceSummary({ snapshot }: { snapshot: StockRow }) {
  const { close, change, change_pct: pct } = snapshot;
  if (close === null) return null;
  const direction = change === null || change === 0 ? "flat" : change > 0 ? "up" : "down";
  const color = direction === "up" ? "text-up" : direction === "down" ? "text-down" : "text-muted-foreground";
  const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "";

  return (
    <div className="flex flex-col items-end gap-1 text-right">
      <div className="flex items-baseline gap-3">
        <span className={cn("tabular text-3xl font-semibold", color)}>{formatNumber(close, 2)}</span>
        {change !== null && (
          <span className={cn("tabular text-base font-medium", color)} aria-label="漲跌">
            {arrow}
            {formatNumber(Math.abs(change), 2)}
            {pct !== null && `（${pct > 0 ? "+" : ""}${formatNumber(pct, 2)}%）`}
          </span>
        )}
      </div>
      <dl
        className="flex flex-wrap justify-end gap-x-3 gap-y-0.5 text-xs text-muted-foreground"
        aria-label="成交資訊"
      >
        {[
          ["成交量", lots(snapshot.volume)],
          ["成交金額", formatTwd(snapshot.trade_value, 2)],
          ["20 日均量", lots(snapshot.avg_volume_20d)],
        ].map(([k, v]) => (
          <div key={k} className="flex gap-1">
            <dt>{k}</dt>
            <dd className="tabular text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
      <span className="text-xs text-muted-foreground">收盤價（{snapshot.price_date}）</span>
    </div>
  );
}
