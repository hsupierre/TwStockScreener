/**
 * 每日健康檢查的判斷邏輯（純函式，方便測試）。
 *
 * 用 data_freshness.daily 的 finished_at（ETL 實際執行時間）判斷，而不是 as_of（交易日）：
 * 春節等長假期間沒有新交易日，但 ETL 仍照常執行，不應誤判為停擺。
 * 每日 ETL 只在週一至五執行，週末最長約 50 小時沒有新紀錄，所以門檻設 72 小時。
 */
export const STALE_AFTER_HOURS = 72;

export interface HealthInput {
  dailyFinishedAt: string | null;
  now: Date;
}

export interface HealthStatus {
  ageHours: number | null;
  stale: boolean;
}

export function evaluateHealth({ dailyFinishedAt, now }: HealthInput): HealthStatus {
  if (!dailyFinishedAt) return { ageHours: null, stale: true };
  const finished = new Date(dailyFinishedAt).getTime();
  if (Number.isNaN(finished)) return { ageHours: null, stale: true };
  const ageHours = Math.round(((now.getTime() - finished) / 3_600_000) * 10) / 10;
  return { ageHours, stale: ageHours > STALE_AFTER_HOURS };
}
