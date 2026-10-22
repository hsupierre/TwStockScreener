import type { Freshness, FreshnessJob } from "./types";

export const FRESHNESS_LABELS: Record<Exclude<FreshnessJob, "snapshot">, string> = {
  daily: "股價估值",
  monthly: "月營收",
  quarterly: "季報",
  dividend: "股利",
};

export interface FreshnessStatus {
  job: FreshnessJob;
  label: string;
  asOf: string;
  stale: boolean;
}

function taipeiParts(now: Date): { year: number; month: number; day: number } {
  const [year, month, day] = now
    .toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" })
    .split("-")
    .map(Number) as [number, number, number];
  return { year, month, day };
}

/** 依公告期限推算「現在應該已經有的」最新月營收（每月 10 日前公告，留 5 天緩衝）。 */
export function expectedRevenueMonth(now: Date): string {
  const { year, month, day } = taipeiParts(now);
  const back = day >= 15 ? 1 : 2;
  const idx = year * 12 + (month - 1) - back;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

/** 依季報公告期限推算應有的最新一季（Q4 年報 3/31、Q1 5/15、Q2 8/14、Q3 11/14，各留 7 天緩衝）。 */
export function expectedQuarter(now: Date): string {
  const { year, month, day } = taipeiParts(now);
  const md = month * 100 + day;
  if (md >= 1121) return `${year}Q3`;
  if (md >= 821) return `${year}Q2`;
  if (md >= 522) return `${year}Q1`;
  if (md >= 407) return `${year - 1}Q4`;
  return `${year - 1}Q3`;
}

const DAY = 86_400_000;

export function freshnessStatus(items: readonly Freshness[], now: Date): FreshnessStatus[] {
  const byJob = new Map(items.map((f) => [f.job, f]));
  const out: FreshnessStatus[] = [];
  for (const job of ["daily", "monthly", "quarterly", "dividend"] as const) {
    const f = byJob.get(job);
    if (!f) continue;
    let stale = false;
    if (job === "daily") stale = now.getTime() - new Date(`${f.asOf}T14:30:00+08:00`).getTime() > 5 * DAY;
    if (job === "monthly") stale = f.asOf < expectedRevenueMonth(now);
    if (job === "quarterly") stale = f.asOf < expectedQuarter(now);
    if (job === "dividend") stale = now.getTime() - new Date(f.finishedAt).getTime() > 14 * DAY;
    out.push({ job, label: FRESHNESS_LABELS[job], asOf: f.asOf, stale });
  }
  return out;
}
