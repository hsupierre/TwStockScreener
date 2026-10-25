"use client";

import { useSyncExternalStore } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { readTheme, subscribeTheme } from "@/lib/theme";

/** shadcn 的 Sonner 元件；配色跟隨網站的「網站外觀」設定（原版依賴 next-themes）。 */
function Toaster(props: ToasterProps) {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "system" as const);
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
