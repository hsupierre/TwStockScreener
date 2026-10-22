import { readFile } from "node:fs/promises";

import { expect, type Page, test } from "@playwright/test";

// 使用真實的 Supabase 快照（唯讀）；斷言只依賴不易變動的事實，例如總檔數 ≥ 1,500、2330 存在。

async function resultCount(page: Page): Promise<{ count: number; total: number }> {
  const text = (await page.getByText(/符合條件/).textContent()) ?? "";
  const [count, total] = [...text.matchAll(/([\d,]+)\s*檔/g)].map((m) => Number(m[1]!.replace(/,/g, "")));
  return { count: count!, total: total! };
}

test.describe("選股器", () => {
  test("載入完整快照並顯示資料日期", async ({ page }) => {
    await page.goto("/screener");
    await expect(page.getByRole("heading", { level: 1, name: "台股選股" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    const { count, total } = await resultCount(page);
    expect(total).toBeGreaterThanOrEqual(1500);
    expect(count).toBe(total);
    await expect(page.getByLabel("資料日期")).toContainText("季報");
  });

  test("套用存股模板 → 排序 → 匯出 CSV → 分享網址重新開啟結果一致", async ({ page, isMobile }) => {
    await page.goto("/screener");
    await expect(page.getByRole("table")).toBeVisible();

    await page.getByRole("button", { name: "存股" }).click();
    await expect(page).toHaveURL(/dy=4~/);
    await expect(page.getByRole("button", { name: "存股" })).toHaveAttribute("aria-pressed", "true");
    const afterPreset = await resultCount(page);
    expect(afterPreset.count).toBeGreaterThan(0);
    expect(afterPreset.count).toBeLessThan(afterPreset.total);
    await expect(page.getByRole("columnheader", { name: /殖利率/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );

    // 改用 ROE 排序
    await page.getByRole("columnheader", { name: /^ROE/ }).getByRole("button").click();
    await expect(page).toHaveURL(/s=roe\.desc/);
    await expect(page.getByRole("columnheader", { name: /^ROE/ })).toHaveAttribute("aria-sort", "descending");

    if (!isMobile) {
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: "匯出 CSV" }).click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/^台股選股_\d{8}\.csv$/);
      const csv = await readFile((await download.path())!, "utf-8");
      const lines = csv.replace(/^﻿/, "").trim().split(/\r?\n/);
      expect(lines[0]).toContain("代號,名稱,市場,產業");
      expect(lines).toHaveLength(afterPreset.count + 1);
    }

    // 用同一個網址重新開啟（模擬分享連結）
    const shared = page.url();
    await page.goto("about:blank");
    await page.goto(shared);
    await expect(page.getByRole("table")).toBeVisible();
    expect(await resultCount(page)).toEqual(afterPreset);
    await expect(page.getByRole("columnheader", { name: /^ROE/ })).toHaveAttribute("aria-sort", "descending");
  });

  test("搜尋代號與輸入範圍條件", async ({ page, isMobile }) => {
    await page.goto("/screener");
    await expect(page.getByRole("table")).toBeVisible();

    /** 手機版的篩選條件在側邊面板裡；面板開啟時背景會被設為 aria-hidden，操作完要關閉才能檢查結果 */
    async function withPanel(fn: (panel: ReturnType<Page["getByRole"]>) => Promise<void>) {
      if (isMobile) await page.getByRole("button", { name: /^篩選/ }).click();
      await fn(page.getByRole("search", { name: "篩選條件" }));
      if (isMobile) await page.keyboard.press("Escape");
    }

    await withPanel((panel) => panel.getByLabel("搜尋股票代號或名稱").fill("2330"));
    await expect(page.getByRole("rowheader").first()).toContainText("台積電");
    const total = (await resultCount(page)).total;

    await withPanel(async (panel) => {
      await panel.getByLabel("搜尋股票代號或名稱").fill("");
      await panel.getByLabel("本益比最大值").fill("8");
    });
    await expect(page).toHaveURL(/pe=~8/);
    expect((await resultCount(page)).count).toBeLessThan(total);

    await withPanel((panel) => panel.getByRole("button", { name: "全部清除" }).click());
    await expect(page).not.toHaveURL(/pe=/);
    expect((await resultCount(page)).count).toBe(total);
  });

  test("首頁的策略卡片直接開啟對應條件", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /價值/ }).click();
    await expect(page).toHaveURL(/\/screener\?.*pe=~12/);
    await expect(page.getByRole("button", { name: "價值" })).toHaveAttribute("aria-pressed", "true");
  });

  test("手機寬度不出現整頁橫向捲動", async ({ page }) => {
    await page.goto("/screener");
    await expect(page.getByRole("table")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
