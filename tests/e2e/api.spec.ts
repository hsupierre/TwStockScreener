import { expect, test } from "@playwright/test";

// 完整的授權邏輯由單元測試涵蓋（src/app/api/revalidate/route.test.ts）；這裡確認部署後的端點不會被任意觸發。
test.describe("/api/revalidate", () => {
  test("沒有或錯誤的密鑰一律拒絕", async ({ request }) => {
    for (const authorization of [undefined, "Bearer wrong-secret"]) {
      const res = await request.post("/api/revalidate", {
        headers: authorization ? { authorization } : {},
        data: { tags: ["snapshot"] },
      });
      // 401：密鑰錯誤；503：伺服器沒有設定密鑰（本機測試環境）。兩者都不會清除快取
      expect([401, 503]).toContain(res.status());
      expect(res.headers()["cache-control"]).toBe("no-store");
    }
  });

  test("只接受 POST", async ({ request }) => {
    expect((await request.get("/api/revalidate")).status()).toBe(405);
  });
});
