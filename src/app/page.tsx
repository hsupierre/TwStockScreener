import { Gauge, Layers, Share2 } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: Gauge,
    title: "基本面多條件篩選",
    description: "本益比、殖利率、ROE、毛利率、營收年增率、負債比等指標自由組合。",
  },
  {
    icon: Layers,
    title: "內建策略模板",
    description: "存股、價值、成長、財務體質，一鍵套用，再依自己的需求微調。",
  },
  {
    icon: Share2,
    title: "條件可分享",
    description: "篩選條件保存在網址中，複製連結就能分享，不需要註冊。",
  },
] as const;

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:py-20">
      <section className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">用基本面找出值得研究的台股</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          涵蓋上市、上櫃約 1,800 檔股票，每日收盤後更新估值，月營收與季報公告後同步更新。
        </p>
      </section>

      <section aria-label="功能" className="mt-12 grid gap-4 sm:grid-cols-3">
        {features.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardHeader>
              <Icon className="mb-2 size-6 text-muted-foreground" aria-hidden />
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </div>
  );
}
