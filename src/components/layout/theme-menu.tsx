"use client";

import { cn } from "cn";
import { Monitor, Moon, Palette, Sun } from "lucide-react";
import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { applyTheme, readTheme, saveTheme, subscribeTheme, type Theme, watchSystemTheme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "system", label: "系統" },
  { value: "light", label: "亮色" },
  { value: "dark", label: "暗色" },
];

const ICONS = { system: Monitor, light: Sun, dark: Moon } as const;

export function ThemeMenu() {
  // 伺服器端不知道使用者的選擇：先以「系統」渲染，hydration 後再換成實際值（不會造成 hydration 錯誤）
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "system" as const);
  const Icon = ICONS[theme];

  // 開發模式的 Strict Mode 重新掛載時，React 會清掉 <html> 上由腳本加的 class，在繪製前補回
  useLayoutEffect(() => applyTheme(readTheme()), []);
  useEffect(() => watchSystemTheme(readTheme), []);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="網站外觀" title="網站外觀">
          <Icon className="size-5" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <fieldset>
          <legend className="flex items-center gap-2 font-semibold">
            <Palette className="size-4" aria-hidden />
            網站外觀
          </legend>
          <p className="mt-1 text-sm text-muted-foreground">選擇偏好的配色模式；「系統」會跟隨裝置的設定。</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {OPTIONS.map((o) => (
              <label
                key={o.value}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-2 text-sm transition-colors hover:bg-accent has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50",
                  theme === o.value && "border-primary ring-1 ring-primary",
                )}
              >
                <input
                  type="radio"
                  name="theme"
                  value={o.value}
                  checked={theme === o.value}
                  onChange={() => saveTheme(o.value)}
                  className="sr-only"
                />
                <ThemePreview theme={o.value} />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}

/** 迷你視窗示意圖；顏色固定，不隨目前的配色改變。 */
function ThemePreview({ theme }: { theme: Theme }) {
  if (theme === "system") {
    return (
      <span className="relative block w-full" aria-hidden>
        <MiniWindow tone="light" />
        <span className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]">
          <MiniWindow tone="dark" />
        </span>
      </span>
    );
  }
  return (
    <span className="block w-full" aria-hidden>
      <MiniWindow tone={theme} />
    </span>
  );
}

function MiniWindow({ tone }: { tone: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <span
      className={cn(
        "block aspect-[8/5] w-full overflow-hidden rounded-md border",
        dark ? "border-neutral-600 bg-neutral-800" : "border-neutral-300 bg-white",
      )}
    >
      <span
        className={cn("flex h-2.5 items-center gap-0.5 px-1", dark ? "bg-neutral-700" : "bg-neutral-200")}
      >
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1 rounded-full bg-neutral-400" />
        ))}
      </span>
      <span className="flex flex-col gap-1 p-1.5">
        {["w-3/4", "w-1/2", "w-2/3"].map((w) => (
          <span key={w} className={cn("h-1 rounded-full", w, dark ? "bg-neutral-500" : "bg-neutral-300")} />
        ))}
      </span>
    </span>
  );
}
