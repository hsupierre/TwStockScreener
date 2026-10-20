import { describe, expect, it } from "vitest";

import { parseEnv, publicEnvSchema, serverEnvSchema } from "./env";

const validPublic = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
};

describe("parseEnv", () => {
  it("接受合法的公開設定，並套用網站網址預設值", () => {
    const env = parseEnv(publicEnvSchema, validPublic);
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://abc.supabase.co");
  });

  it("空字串視為未設定", () => {
    expect(() => parseEnv(publicEnvSchema, { ...validPublic, NEXT_PUBLIC_SUPABASE_ANON_KEY: "" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });

  it("錯誤訊息列出所有缺漏的變數", () => {
    try {
      parseEnv(serverEnvSchema, {});
      expect.unreachable();
    } catch (e) {
      const msg = (e as Error).message;
      for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "REVALIDATE_SECRET"]) {
        expect(msg).toContain(key);
      }
    }
  });

  it("REVALIDATE_SECRET 太短會被拒絕", () => {
    expect(() =>
      parseEnv(serverEnvSchema, {
        ...validPublic,
        SUPABASE_SERVICE_ROLE_KEY: "x",
        REVALIDATE_SECRET: "short",
      }),
    ).toThrow(/32/);
  });

  it("網址格式錯誤會被拒絕", () => {
    expect(() =>
      parseEnv(publicEnvSchema, { ...validPublic, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" }),
    ).toThrow();
  });
});
