"use client";

import { AlertTriangle } from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FRESHNESS_LABELS, freshnessStatus } from "@/lib/screener/freshness";
import type { Freshness } from "@/lib/screener/types";

const noopSubscribe = () => () => {};
let clientNow: number | null = null;
const getClientNow = () => (clientNow ??= Date.now());
const getServerNow = () => null;

/**
 * 顯示各資料集的資料基準；過期判斷需要「現在時間」，在瀏覽器端計算，
 * 靜態頁面才不會因為建置時間而誤判（也避免 hydration 不一致）。
 */
export function DataFreshness({ items }: { items: readonly Freshness[] }) {
  // 伺服器與 hydration 時為 null（不判斷過期），瀏覽器端取得現在時間後再計算
  const now = useSyncExternalStore(noopSubscribe, getClientNow, getServerNow);
  const status = useMemo(() => (now === null ? null : freshnessStatus(items, new Date(now))), [items, now]);

  const shown = status ?? items.flatMap((f) => (f.job === "snapshot" ? [] : [{ ...f, stale: false }]));
  const stale = (status ?? []).filter((s) => s.stale);

  return (
    <div className="flex flex-col gap-2">
      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="資料日期">
        {shown.map((s) => (
          <div key={s.job} className="flex gap-1">
            <dt>{FRESHNESS_LABELS[s.job as keyof typeof FRESHNESS_LABELS]}</dt>
            <dd className={s.stale ? "font-medium text-destructive" : "text-foreground"}>{s.asOf}</dd>
          </div>
        ))}
      </dl>
      {stale.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden />
          <AlertTitle>部分資料可能尚未更新</AlertTitle>
          <AlertDescription>
            {stale.map((s) => `${s.label}（${s.asOf}）`).join("、")}
            比預期的更新時間晚，篩選結果可能不是最新的。
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
