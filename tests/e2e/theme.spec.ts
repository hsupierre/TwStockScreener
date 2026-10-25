import { expect, test } from "@playwright/test";

test.describe("配色模式", () => {
  test("預設跟隨系統；手動選擇後重新整理、換頁都保留", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).toHaveClass(/\bdark\b/);

    await page.getByRole("button", { name: "網站外觀" }).click();
    await expect(page.getByRole("radio", { name: "系統" })).toBeChecked();
    await page.getByText("亮色", { exact: true }).click();
    await expect(html).not.toHaveClass(/\bdark\b/);

    // 系統仍是暗色，但手動選了亮色：重新整理後（hydration 前的內嵌腳本）仍是亮色
    await page.reload();
    await expect(html).not.toHaveClass(/\bdark\b/);
    await expect(html).toHaveCSS("color-scheme", "light");

    await page.goto("/stocks/2330");
    await expect(html).not.toHaveClass(/\bdark\b/);

    await page.getByRole("button", { name: "網站外觀" }).click();
    await page.getByText("系統", { exact: true }).click();
    await expect(html).toHaveClass(/\bdark\b/);
  });
});
