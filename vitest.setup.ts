import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// 沒有開啟 vitest globals，Testing Library 不會自動清理，需手動註冊
afterEach(() => cleanup());

// jsdom 沒有 ResizeObserver（TanStack Virtual、Radix 會用到）
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// ── 會員功能：瀏覽器端 Supabase client 換成記憶體版（見 src/test/fake-supabase.ts）──
vi.mock("@/lib/supabase/client", async () => {
  const { createFakeSupabaseClient } = await import("@/test/fake-supabase");
  return { createSupabaseBrowserClient: createFakeSupabaseClient };
});

// jsdom 裡沒有 App Router；需要檢查導頁的測試可以用 routerMock
vi.mock("next/navigation", async () => {
  const { routerMock, navigationState } = await import("@/test/navigation");
  return {
    useRouter: () => routerMock,
    usePathname: () => navigationState.pathname,
    useSearchParams: () => new URLSearchParams(navigationState.search),
    notFound: () => {
      throw new Error("NEXT_NOT_FOUND");
    },
  };
});

beforeEach(async () => {
  const [{ fake }, { resetNavigation }, auth, watchlist, screens] = await Promise.all([
    import("@/test/fake-supabase"),
    import("@/test/navigation"),
    import("@/lib/auth/session"),
    import("@/lib/member/watchlist"),
    import("@/lib/member/screens"),
  ]);
  fake.reset();
  resetNavigation();
  auth.resetAuthForTest();
  watchlist.resetWatchlistForTest();
  screens.resetScreensForTest();
});
