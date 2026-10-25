import { ChevronRight } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EpsChart, RevenueChart } from "@/components/stock/lazy-charts";
import { DividendTable, QuarterlyTable } from "@/components/stock/financial-tables";
import { WatchButton } from "@/components/member/watch-button";
import { KeyMetrics } from "@/components/stock/key-metrics";
import { PriceSummary } from "@/components/stock/price-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSiteUrl } from "@/lib/env";
import { EMPTY, formatNumber, formatPercent, formatTwd } from "@/lib/format";
import { getSnapshot } from "@/lib/data/snapshot";
import { getStockDetail, type StockDetail } from "@/lib/data/stock";
import { screenerHref } from "@/lib/screener/search-params";
import { MARKET_LABELS, type Market } from "@/lib/screener/types";
import { siteConfig } from "@/lib/site";
import { dividendYears, revenueSeries, summarizeQuarters } from "@/lib/stock/compute";

/**
 * 整頁必須是靜態輸出：沒有預先產生的代號，第一次請求會等頁面產生完成再回應，
 * 所以不存在的代號能回傳真正的 404（而不是串流後才 notFound 的 200）。
 */
export const ensureStatic = "navigation";

const PRERENDER_COUNT = 100;

/** build 時只預先產生市值前 100 大，其餘第一次造訪時產生並快取。 */
export async function generateStaticParams() {
  const { rows } = await getSnapshot();
  return [...rows]
    .sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0))
    .slice(0, PRERENDER_COUNT)
    .map((r) => ({ code: r.code }));
}

function describe(d: StockDetail): string {
  const s = d.snapshot;
  const { name, code } = d.company;
  if (!s) return `${name}（${code}）的基本面資料：月營收、季報、股利。`;
  const parts = [
    s.close !== null && `股價 ${formatNumber(s.close, 2)} 元`,
    s.pe !== null && `本益比 ${formatNumber(s.pe, 2)} 倍`,
    s.dividend_yield !== null && `殖利率 ${formatPercent(s.dividend_yield, 2)}`,
    s.eps_ttm !== null && `近四季 EPS ${formatNumber(s.eps_ttm, 2)} 元`,
    s.roe_ttm !== null && `ROE ${formatPercent(s.roe_ttm, 1)}`,
    s.revenue_yoy !== null && `月營收年增 ${formatPercent(s.revenue_yoy, 1, { signed: true })}`,
  ].filter(Boolean);
  return `${name}（${code}）${parts.join("、")}。近 12 季財報、24 個月營收趨勢與歷年股利。`;
}

export async function generateMetadata({ params }: PageProps<"/stocks/[code]">): Promise<Metadata> {
  const { code } = await params;
  const detail = await getStockDetail(code);
  // notFound() 會自動加上 noindex，這裡只需要標題
  if (!detail) return { title: "找不到這檔股票" };
  const { name } = detail.company;
  const title = `${name}（${code}）本益比、殖利率、EPS、月營收`;
  const description = describe(detail);
  return {
    title,
    description,
    alternates: { canonical: `/stocks/${code}` },
    openGraph: {
      type: "article",
      title: `${title}｜${siteConfig.name}`,
      description,
      url: `/stocks/${code}`,
    },
  };
}

function Section({
  id,
  title,
  children,
  note,
}: {
  id: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}

export default async function StockPage({ params }: PageProps<"/stocks/[code]">) {
  const { code } = await params;
  const detail = await getStockDetail(code);
  if (!detail) notFound();

  const { company, snapshot } = detail;
  const quarters = summarizeQuarters(detail.financials);
  const revenues = revenueSeries(detail.revenues);
  const dividends = dividendYears(detail.dividends).slice(0, 10);
  const market = MARKET_LABELS[company.market as Market] ?? company.market;
  const site = getSiteUrl();

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: siteConfig.name, item: new URL("/", site).toString() },
      { "@type": "ListItem", position: 2, name: "選股", item: new URL("/screener", site).toString() },
      { "@type": "ListItem", position: 3, name: `${company.name}（${code}）` },
    ],
  };

  return (
    <article className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6">
      <script
        type="application/ld+json"
        // 內容皆為伺服器端產生的固定結構，跳脫 < 避免結束 script 標籤
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb).replace(/</g, "\\u003c") }}
      />

      <nav aria-label="麵包屑" className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          首頁
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <Link href="/screener" className="hover:text-foreground">
          選股
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="text-foreground">{company.name}</span>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">
            {company.name}
            <span className="ml-3 font-mono text-xl font-normal text-muted-foreground">{code}</span>
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{market}</Badge>
            {company.industry && <Badge variant="outline">{company.industry}</Badge>}
            {snapshot?.financial_period && (
              <span className="text-xs text-muted-foreground">
                季報 {snapshot.financial_period}・月營收 {snapshot.revenue_period ?? EMPTY}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-end gap-4">
          {snapshot && <PriceSummary snapshot={snapshot} />}
          <div className="flex flex-col items-end gap-2">
            <WatchButton code={code} name={company.name} />
            {company.industry && (
              <Button asChild variant="outline" size="sm">
                <Link href={screenerHref({ ind: [company.industry] }) as Route}>同產業選股</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {snapshot ? (
        <Section id="metrics" title="重點指標" note="近四季（TTM）計算；金融業不適用毛利率等指標">
          <KeyMetrics snapshot={snapshot} />
        </Section>
      ) : (
        <p className="text-sm text-muted-foreground">這檔股票目前沒有選股快照資料。</p>
      )}

      <Section id="revenue" title="月營收" note="近 24 個月，單位：億元">
        {revenues.length > 0 ? (
          <RevenueChart data={revenues} />
        ) : (
          <p className="text-sm text-muted-foreground">尚無月營收資料。</p>
        )}
      </Section>

      <Section id="quarterly" title="季報" note="近 12 季單季數字（由年度累計值換算）">
        {quarters.length > 0 && <EpsChart data={quarters} />}
        <QuarterlyTable quarters={quarters} />
      </Section>

      <Section id="dividends" title="股利" note="依股利所屬年度合計；季配息會加總四季">
        <DividendTable years={dividends} />
      </Section>

      <Section id="company" title="公司資料">
        <dl className="grid gap-x-8 gap-y-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
          {[
            ["公司名稱", company.full_name ?? company.name],
            ["市場", market],
            ["產業", company.industry ?? EMPTY],
            ["上市櫃日期", company.listed_at ?? EMPTY],
            ["實收資本額", formatTwd(company.capital, 1)],
            [
              "已發行普通股",
              company.shares_outstanding ? `${formatNumber(company.shares_outstanding / 1000, 0)} 張` : EMPTY,
            ],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b pb-2 sm:border-b-0 sm:pb-0">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="tabular text-right">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </article>
  );
}
