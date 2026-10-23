import { ImageResponse } from "next/og";

import { getStockDetail } from "@/lib/data/stock";
import { formatNumber, formatPercent } from "@/lib/format";
import { fontData, loadFontSubset } from "@/lib/og-font";
import { MARKET_LABELS, type Market } from "@/lib/screener/types";
import { siteConfig } from "@/lib/site";

export const alt = "個股基本面摘要";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const detail = await getStockDetail(code);
  const s = detail?.snapshot;

  const title = detail ? detail.company.name : code;
  const subtitle = detail
    ? [MARKET_LABELS[detail.company.market as Market], detail.company.industry].filter(Boolean).join("・")
    : "";
  const stats: [string, string][] = [
    ["股價", formatNumber(s?.close ?? null, 2)],
    ["本益比", formatNumber(s?.pe ?? null, 2)],
    ["殖利率", formatPercent(s?.dividend_yield ?? null, 2)],
    ["ROE", formatPercent(s?.roe_ttm ?? null, 1)],
  ];
  const footer = s?.price_date ? `資料日期 ${s.price_date}・${siteConfig.name}` : siteConfig.name;

  const text = [title, subtitle, footer, code, ...stats.flat(), "基本面摘要"].join("");
  const font = await loadFontSubset("Noto Sans TC", 700, text);
  const fonts = font
    ? [{ name: "NotoSansTC", data: fontData(font), weight: 700 as const, style: "normal" as const }]
    : [];

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background: "#ffffff",
        color: "#0a0a0a",
        fontFamily: font ? "NotoSansTC" : "sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
          <span style={{ fontSize: 88, fontWeight: 700 }}>{font ? title : code}</span>
          {font && <span style={{ fontSize: 48, color: "#737373" }}>{code}</span>}
        </div>
        {font && subtitle && <span style={{ fontSize: 32, color: "#525252" }}>{subtitle}</span>}
      </div>
      <div style={{ display: "flex", gap: 24 }}>
        {stats.map(([label, value]) => (
          <div
            key={label}
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              padding: "20px 24px",
              border: "2px solid #e5e5e5",
              borderRadius: 16,
            }}
          >
            <span style={{ fontSize: 26, color: "#737373" }}>{font ? label : ""}</span>
            <span style={{ fontSize: 48, fontWeight: 700 }}>{value}</span>
          </div>
        ))}
      </div>
      <span style={{ fontSize: 24, color: "#737373" }}>{font ? footer : (s?.price_date ?? "")}</span>
    </div>,
    {
      ...size,
      fonts,
      // 讓 CDN 快取一天（背景更新一週內有效），社群網站抓預覽圖時不必每次重新產生
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
    },
  );
}
