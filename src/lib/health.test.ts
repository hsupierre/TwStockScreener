import { describe, expect, it } from "vitest";

import { evaluateHealth, STALE_AFTER_HOURS } from "./health";

const now = new Date("2026-10-26T02:17:00Z"); // 週一上午 10:17（台灣）

describe("evaluateHealth", () => {
  it("週末沒有每日 ETL 不算停擺（上次是週六早上 07:47）", () => {
    const h = evaluateHealth({ dailyFinishedAt: "2026-10-23T23:48:00Z", now });
    expect(h.stale).toBe(false);
    expect(h.ageHours).toBeLessThan(STALE_AFTER_HOURS);
  });

  it("超過 72 小時沒有執行視為停擺", () => {
    const h = evaluateHealth({ dailyFinishedAt: "2026-10-22T23:00:00Z", now });
    expect(h).toEqual({ ageHours: 75.3, stale: true });
  });

  it("沒有紀錄或時間格式錯誤也視為停擺", () => {
    expect(evaluateHealth({ dailyFinishedAt: null, now })).toEqual({ ageHours: null, stale: true });
    expect(evaluateHealth({ dailyFinishedAt: "not-a-date", now }).stale).toBe(true);
  });
});
