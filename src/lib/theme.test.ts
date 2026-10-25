import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyTheme,
  parseTheme,
  readTheme,
  saveTheme,
  subscribeTheme,
  THEME_SCRIPT,
  THEME_STORAGE_KEY,
} from "./theme";

let systemDark = false;
const listeners = new Set<() => void>();

function mockMatchMedia() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      return query.includes("dark") && systemDark;
    },
    media: query,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }));
}

beforeEach(() => {
  systemDark = false;
  listeners.clear();
  mockMatchMedia();
  localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.style.colorScheme = "";
});

afterEach(() => vi.restoreAllMocks());

const isDark = () => document.documentElement.classList.contains("dark");

describe("parseTheme / readTheme", () => {
  it("只接受三種值，其他一律當作系統", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("blue")).toBe("system");
    expect(parseTheme(null)).toBe("system");
  });

  it("localStorage 無法使用時回傳系統", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(readTheme()).toBe("system");
  });
});

describe("THEME_SCRIPT（<head> 內嵌腳本）", () => {
  const run = () => new Function(THEME_SCRIPT)();

  it("沒有設定時跟隨系統", () => {
    systemDark = true;
    run();
    expect(isDark()).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("手動選擇優先於系統設定", () => {
    systemDark = true;
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    run();
    expect(isDark()).toBe(false);

    systemDark = false;
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    run();
    expect(isDark()).toBe(true);
  });
});

describe("saveTheme / applyTheme", () => {
  it("儲存並套用；選系統時移除設定", () => {
    saveTheme("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(isDark()).toBe(true);

    saveTheme("system");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(isDark()).toBe(false);
  });

  it("同步網址列顏色", () => {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.append(meta);
    applyTheme("dark");
    expect(meta.content).toBe("#0a0a0a");
    applyTheme("light");
    expect(meta.content).toBe("#ffffff");
    meta.remove();
  });

  it("切換時通知訂閱者；其他分頁改設定也會套用", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeTheme(onChange);
    saveTheme("light");
    expect(onChange).toHaveBeenCalledTimes(1);

    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY }));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(isDark()).toBe(true);

    unsubscribe();
    saveTheme("light");
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
