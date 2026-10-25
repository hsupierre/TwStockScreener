import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/auth/"] }],
    sitemap: new URL("/sitemap.xml", site).toString(),
  };
}
