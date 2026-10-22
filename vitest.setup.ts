import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// 沒有開啟 vitest globals，Testing Library 不會自動清理，需手動註冊
afterEach(() => cleanup());

// jsdom 沒有 ResizeObserver（TanStack Virtual、Radix 會用到）
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
