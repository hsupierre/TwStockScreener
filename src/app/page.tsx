import { ArrowRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PRESETS } from "@/lib/screener/presets";
import { presetHref } from "@/lib/screener/search-params";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:py-20">
      <section className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">用基本面找出值得研究的台股</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          涵蓋上市、上櫃約 1,900 檔股票，可依本益比、殖利率、ROE、營收成長、負債比等條件自由組合；
          每日收盤後更新估值，月營收與季報公告後同步更新。
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link href="/screener">
            開始選股
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </section>

      <section aria-labelledby="presets-heading" className="mt-16">
        <h2 id="presets-heading" className="text-xl font-semibold">
          從策略模板開始
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          套用後可以再調整任何條件；篩選條件會保存在網址中，方便分享。
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PRESETS.map((p) => (
            <Link key={p.id} href={presetHref(p) as Route} className="group">
              <Card className="h-full transition-colors group-hover:border-foreground/30">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {p.name}
                    <ArrowRight
                      className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </CardTitle>
                  <CardDescription>{p.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
