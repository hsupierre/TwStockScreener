import { ChartNoAxesColumn } from "lucide-react";
import Link from "next/link";

import { siteConfig } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <ChartNoAxesColumn className="size-5" aria-hidden />
          <span>{siteConfig.name}</span>
        </Link>
      </div>
    </header>
  );
}
