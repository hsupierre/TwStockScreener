import { describe, expect, it } from "vitest";

import { loginHref, safeNext } from "./redirect";

describe("safeNext", () => {
  it.each(["/", "/screener?dy=4~", "/stocks/2330"])("接受站內路徑 %s", (p) => {
    expect(safeNext(p)).toBe(p);
  });

  it.each([null, "", "https://evil.com", "//evil.com", "/\\evil.com", "/\t/evil.com", "javascript:alert(1)"])(
    "拒絕 %s（open redirect）",
    (p) => {
      expect(safeNext(p)).toBe("/");
      expect(safeNext(p, "/watchlist")).toBe("/watchlist");
    },
  );
});

describe("loginHref", () => {
  it("帶上要回到的頁面；首頁不帶參數", () => {
    expect(loginHref("/screener?dy=4~")).toBe("/login?next=%2Fscreener%3Fdy%3D4~");
    expect(loginHref("/")).toBe("/login");
    expect(loginHref("//evil.com")).toBe("/login");
  });
});
