import type { MetadataRoute } from "next";

import { getSnapshot } from "@/lib/data/snapshot";
import { getSiteUrl } from "@/lib/env";

/** 首頁、選股器與所有上市櫃個股頁（約 2,000 個網址，遠低於單一 sitemap 5 萬筆的上限）。 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = getSiteUrl();
  const { rows, freshness } = await getSnapshot();
  const updated = freshness.find((f) => f.job === "snapshot")?.finishedAt;
  const lastModified = updated ? new Date(updated) : undefined;
  const url = (path: string) => new URL(path, site).toString();
  return [
    { url: url("/"), changeFrequency: "weekly", priority: 1 },
    { url: url("/screener"), lastModified, changeFrequency: "daily", priority: 0.9 },
    ...rows.map((r) => ({
      url: url(`/stocks/${r.code}`),
      lastModified,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];
}
