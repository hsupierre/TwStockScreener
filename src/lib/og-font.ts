import "server-only";

import { cacheLife } from "next/cache";

/**
 * 從 Google Fonts 取得「只包含指定文字」的字型子集（通常只有數十 KB），給 OG 圖片使用。
 * 不指定 User-Agent 時 Google Fonts 會回傳 TrueType，Satori（next/og）可以直接使用。
 * 以 base64 字串快取（use cache 的回傳值必須可序列化）；失敗時回傳 null，呼叫端改用不含中文的版面。
 */
export async function loadFontSubset(family: string, weight: number, text: string): Promise<string | null> {
  "use cache";
  cacheLife("max");
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(cssUrl)).text();
    const src = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!src) return null;
    const res = await fetch(src);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer()).toString("base64");
  } catch {
    return null;
  }
}

export function fontData(base64: string): ArrayBuffer {
  const buf = Buffer.from(base64, "base64");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}
