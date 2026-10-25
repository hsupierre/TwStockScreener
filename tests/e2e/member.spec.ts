import { expect, test } from "./member-fixture";

test.describe("未登入", () => {
  test("header 的登入連結、加入自選都會導向登入頁，並記住原本的頁面", async ({ page }) => {
    await page.goto("/stocks/2330");
    const watch = page.getByRole("button", { name: "加入自選" });
    await expect(watch).toBeEnabled();
    await watch.click();
    await expect(page).toHaveURL(/\/login\?next=%2Fstocks%2F2330$/);
    await expect(page.getByRole("heading", { name: "登入會員" })).toBeVisible();
    await expect(page.getByRole("button", { name: "使用 Google 帳號登入" })).toBeEnabled();

    await page.goto("/watchlist");
    await expect(page.getByText("登入後才能使用自選股")).toBeVisible();
  });
});

test.describe("已登入會員", () => {
  test("個股頁加入自選 → 自選股頁 → 從表格移除", async ({ page, member }) => {
    await page.goto("/stocks/2330");
    await page.getByRole("button", { name: "加入自選" }).click();
    await expect(page.getByRole("button", { name: "已加入自選" })).toBeVisible();

    await page.getByRole("button", { name: "會員選單" }).click();
    await expect(page.getByRole("menu")).toContainText(member.email);
    await page.getByRole("menuitem", { name: "自選股" }).click();

    await expect(page).toHaveURL(/\/watchlist$/);
    const row = page.getByRole("row", { name: /2330/ });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "將 台積電 移出自選股" }).click();
    await expect(page.getByText("還沒有自選股")).toBeVisible();
  });

  test("儲存選股條件 → 我的策略 → 套用 → 刪除", async ({ page, member: _ }) => {
    await page.goto("/screener?dy=4~&pe=~15");
    await page.getByRole("button", { name: "我的策略" }).click();
    await page.getByRole("menuitem", { name: "儲存目前的條件…" }).click();
    const dialog = page.getByRole("dialog", { name: "儲存目前的條件" });
    await dialog.getByLabel("名稱", { exact: true }).fill("E2E 高殖利率");
    await dialog.getByRole("button", { name: "儲存", exact: true }).click();
    await expect(page.getByText("已儲存「E2E 高殖利率」")).toBeVisible();

    await page.goto("/strategies");
    await expect(page.getByText("殖利率 ≥ 4%")).toBeVisible();
    await expect(page.getByText("本益比 ≤ 15倍")).toBeVisible();
    await page.getByRole("link", { name: "套用" }).click();
    await expect(page).toHaveURL(/\/screener\?dy=4~&pe=~15$/);
    // 手機版的篩選面板收在抽屜裡（隱藏），toHaveValue 不受影響
    await expect(page.getByLabel("殖利率最小值").first()).toHaveValue("4");

    await page.goto("/strategies");
    await page.getByRole("button", { name: "刪除「E2E 高殖利率」" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "刪除" }).click();
    await expect(page.getByText("還沒有儲存的策略")).toBeVisible();
  });

  test("登出", async ({ page, member: _ }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "會員選單" }).click();
    await page.getByRole("menuitem", { name: "登出" }).click();
    await expect(page.getByRole("link", { name: "登入" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("link", { name: "登入" })).toBeVisible();
  });

  test("刪除帳號", async ({ page, member }) => {
    await page.goto("/account");
    await expect(page.getByText(member.email).first()).toBeVisible();
    await page.getByRole("button", { name: "刪除我的帳號" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "永久刪除" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: "登入" })).toBeVisible();
  });
});
