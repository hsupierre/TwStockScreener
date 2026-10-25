import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { THEME_STORAGE_KEY } from "@/lib/theme";

import { ThemeMenu } from "./theme-menu";

let systemDark = false;
let onSystemChange: (() => void) | undefined;

beforeEach(() => {
  systemDark = false;
  localStorage.clear();
  document.documentElement.className = "";
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      return systemDark;
    },
    media: query,
    addEventListener: (_: string, fn: () => void) => (onSystemChange = fn),
    removeEventListener: () => (onSystemChange = undefined),
  }));
});

const isDark = () => document.documentElement.classList.contains("dark");

describe("ThemeMenu", () => {
  it("三個選項，預設為系統；選暗色後套用並記住", async () => {
    const user = userEvent.setup();
    render(<ThemeMenu />);
    await user.click(screen.getByRole("button", { name: "網站外觀" }));

    const group = screen.getByRole("group", { name: "網站外觀" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "系統" })).toBeChecked();
    expect(screen.getAllByRole("radio")).toHaveLength(3);

    await user.click(screen.getByRole("radio", { name: "暗色" }));
    expect(screen.getByRole("radio", { name: "暗色" })).toBeChecked();
    expect(isDark()).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    await user.click(screen.getByRole("radio", { name: "亮色" }));
    expect(isDark()).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("讀取已儲存的設定", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    const user = userEvent.setup();
    render(<ThemeMenu />);
    expect(isDark()).toBe(true); // 掛載時補套用（開發模式 Strict Mode 會清掉 class）
    await user.click(screen.getByRole("button", { name: "網站外觀" }));
    expect(screen.getByRole("radio", { name: "暗色" })).toBeChecked();
  });

  it("系統模式下跟著作業系統切換", () => {
    render(<ThemeMenu />);
    expect(isDark()).toBe(false);
    systemDark = true;
    onSystemChange?.();
    expect(isDark()).toBe(true);
  });
});
