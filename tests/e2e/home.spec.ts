import { expect, test } from "@playwright/test";

test.describe("首頁", () => {
  test("顯示標題、功能卡片與免責聲明", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/台股選股/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("基本面");
    await expect(page.getByRole("region", { name: "功能" }).getByText("內建策略模板")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toContainText("不構成任何投資建議");
  });

  test("不存在的頁面回傳 404", async ({ page }) => {
    const res = await page.goto("/this-page-does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "找不到這個頁面" })).toBeVisible();
  });

  test("回應帶有安全性標頭", async ({ request }) => {
    const res = await request.get("/");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["x-frame-options"]).toBe("DENY");
    expect(res.headers()["x-powered-by"]).toBeUndefined();
  });
});
