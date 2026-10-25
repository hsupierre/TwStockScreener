/**
 * 配色模式：系統（跟隨 prefers-color-scheme）、亮色、暗色。
 *
 * 選擇存在 localStorage；<head> 的內嵌腳本（THEME_SCRIPT）在第一次繪製前就套用 `.dark`，
 * 不會閃爍，頁面也能維持靜態產生（不讀 cookie）。
 */

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_STORAGE_KEY = "theme";
const CHANGE_EVENT = "themechange";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/** 與 layout 的 viewport.themeColor 一致（瀏覽器網址列的顏色）。 */
export const THEME_COLORS = { light: "#ffffff", dark: "#0a0a0a" } as const;

export function parseTheme(value: unknown): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : "system";
}

/** 在 <head> 同步執行，必須自給自足（不能引用模組內的其他東西）。 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=t==="dark"||(t!=="light"&&matchMedia(${JSON.stringify(DARK_QUERY)}).matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light"}catch(e){}})()`;

export function readTheme(): Theme {
  try {
    return parseTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  // 手動選擇時，網址列顏色也跟著變（viewport 的 media 只看系統設定）
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.content = THEME_COLORS[resolved];
  });
}

export function saveTheme(theme: Theme): void {
  try {
    if (theme === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // 無痕模式等無法寫入時，只套用到目前頁面
  }
  applyTheme(theme);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** 給 useSyncExternalStore：本頁切換、其他分頁切換（storage 事件）都會通知。 */
export function subscribeTheme(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY) {
      applyTheme(readTheme());
      onChange();
    }
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** 系統模式下，作業系統切換深淺色時跟著變。 */
export function watchSystemTheme(getTheme: () => Theme): () => void {
  const mql = window.matchMedia(DARK_QUERY);
  const onChange = () => {
    if (getTheme() === "system") applyTheme("system");
  };
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}
