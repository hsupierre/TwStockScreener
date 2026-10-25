/** 單元測試用的 next/navigation 狀態（見 vitest.setup.ts）。 */
import { vi } from "vitest";

export const navigationState = { pathname: "/", search: "" };

export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
};

export function resetNavigation() {
  navigationState.pathname = "/";
  navigationState.search = "";
  for (const fn of Object.values(routerMock)) fn.mockClear();
}
