import { expect, test } from "@playwright/test";

// 使用真實資料；2330 一定在預先產生的清單內（市值第一）。

test.describe("個股頁", () => {
  test("顯示各區塊與 SEO 資訊", async ({ page }) => {
    await page.goto("/stocks/2330");
    await expect(page).toHaveTitle(/台積電（2330）.*台股選股/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("台積電");
    for (const name of ["重點指標", "月營收", "季報", "股利", "公司資料"]) {
      await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
    }
    // 季報表：第一欄是項目名稱，其後最多 12 季
    const quarterHeaders = page.getByRole("region", { name: "季報" }).getByRole("columnheader");
    await expect(quarterHeaders.first()).toHaveText("單季");
    expect(await quarterHeaders.count()).toBeGreaterThanOrEqual(5);
    expect(await quarterHeaders.count()).toBeLessThanOrEqual(13);
    await expect(page.getByLabel("近 24 個月營收與年增率")).toBeVisible();
    await expect(page.getByLabel("成交資訊")).toContainText("成交量");
    await expect(page.getByLabel("成交資訊")).toContainText("張");

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/stocks\/2330$/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /本益比/);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /opengraph-image/);
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}");
    expect(ld["@type"]).toBe("BreadcrumbList");
  });

  test("不存在的代號回傳 404 且不被索引", async ({ page }) => {
    for (const code of ["9999", "abcd"]) {
      const res = await page.goto(`/stocks/${code}`);
      expect(res?.status()).toBe(404);
      const robots = await page
        .locator('meta[name="robots"]')
        .evaluateAll((els) => els.map((e) => e.getAttribute("content")));
      expect(robots).toHaveLength(1);
      expect(robots[0]).toContain("noindex");
    }
  });

  test("從選股結果點進個股頁", async ({ page }) => {
    await page.goto("/screener?q=2330");
    await page.getByRole("rowheader").first().getByRole("link").click();
    await expect(page).toHaveURL(/\/stocks\/2330$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("台積電");
  });

  test("同產業選股連結帶入產業條件", async ({ page }) => {
    await page.goto("/stocks/2330");
    await page.getByRole("link", { name: "同產業選股" }).click();
    await expect(page).toHaveURL(/\/screener\?ind=/);
    expect(decodeURIComponent(page.url())).toContain("ind=半導體業");
    // 套用產業條件後，結果數應少於總數
    await expect(page.getByText(/符合條件/)).toBeVisible();
    const text = (await page.getByText(/符合條件/).textContent()) ?? "";
    const [count, total] = [...text.matchAll(/([\d,]+)\s*檔/g)].map((m) => Number(m[1]!.replace(/,/g, "")));
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(total!);
  });
});

test.describe("SEO 檔案", () => {
  test("sitemap 列出所有個股頁", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    const stockUrls = xml.match(/<loc>[^<]*\/stocks\/\d{4}<\/loc>/g) ?? [];
    expect(stockUrls.length).toBeGreaterThanOrEqual(1500);
    expect(xml).toContain("/screener</loc>");
  });

  test("robots.txt 指向 sitemap 並排除 API", async ({ request }) => {
    const txt = await (await request.get("/robots.txt")).text();
    expect(txt).toMatch(/Sitemap: .*\/sitemap\.xml/);
    expect(txt).toContain("Disallow: /api/");
  });

  test("OG 圖片可以產生且可被 CDN 快取", async ({ request }) => {
    const res = await request.get("/stocks/2330/opengraph-image");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/png");
    expect(res.headers()["cache-control"]).toContain("s-maxage=86400");
    expect((await res.body()).length).toBeGreaterThan(10_000);
  });
});
