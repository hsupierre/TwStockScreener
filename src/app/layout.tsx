import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getSiteUrl } from "@/lib/env";
import { siteConfig } from "@/lib/site";
import { THEME_COLORS, THEME_SCRIPT } from "@/lib/theme";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: { default: siteConfig.title, template: `%s｜${siteConfig.name}` },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // 內嵌腳本會在 hydration 前改 <html> 的 class 與 style，所以要 suppressHydrationWarning
    <html lang="zh-Hant-TW" suppressHydrationWarning>
      <head>
        {/* 配色模式：在第一次繪製前套用，避免閃一下亮色（見 src/lib/theme.ts） */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <NuqsAdapter>
          <TooltipProvider delayDuration={300}>
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
            <Toaster position="bottom-center" />
          </TooltipProvider>
          {/* 匿名流量統計（不使用 cookie）；只在 Vercel 上送出資料，本機開發時只會印在 console */}
          <Analytics />
        </NuqsAdapter>
      </body>
    </html>
  );
}
