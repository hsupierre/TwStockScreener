import { ChartNoAxesColumn } from "lucide-react";
import Link from "next/link";

import { UserMenu } from "@/components/auth/user-menu";
import { siteConfig } from "@/lib/site";

import { ThemeMenu } from "./theme-menu";

const NAV = [{ href: "/screener", label: "選股" }] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <ChartNoAxesColumn className="size-5" aria-hidden />
          <span>{siteConfig.name}</span>
        </Link>
        <nav aria-label="主選單" className="flex items-center gap-4 text-sm">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-muted-foreground hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeMenu />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
