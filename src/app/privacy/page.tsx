import type { Metadata } from "next";
import Link from "next/link";

import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "隱私權政策",
  description: `${siteConfig.name}如何蒐集、使用與保護會員資料。`,
  alternates: { canonical: "/privacy" },
};

const UPDATED = "2026 年 10 月 25 日";

export default function PrivacyPage() {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 text-sm leading-7 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">隱私權政策</h1>
        <p className="text-muted-foreground">最後更新：{UPDATED}</p>
      </header>

      <p>
        不登入也能使用{siteConfig.name}的選股與個股資料。本站只會蒐集匿名的流量統計；你使用 Google
        帳號登入、使用會員功能時，才會蒐集下列的會員資料。
      </p>

      <h2>流量統計</h2>
      <p>
        {
          "本站使用 Vercel Web Analytics 統計瀏覽次數、瀏覽的頁面、來源網站、國家與裝置類型，用來了解哪些內容有用。"
        }
        {"它不使用 cookie、不會跨網站追蹤，也無法辨識個別訪客；登入與否都一樣。"}
      </p>

      <h2>會員資料</h2>
      <ul>
        <li>Google 帳號提供的 Email、名稱與頭像網址（本站不會取得你的 Google 密碼）。</li>
        <li>你加入的自選股代號、儲存的選股策略（名稱與篩選條件）。</li>
        <li>登入狀態的 cookie，用來維持登入；「網站外觀」設定只存在你的瀏覽器中。</li>
      </ul>

      <h2>使用目的</h2>
      <ul>
        <li>辨識你的身分，讓你在不同裝置上看到同一份自選股與策略。</li>
        <li>本站不會出售、出租你的資料，也不會用於廣告。</li>
      </ul>

      <h2>儲存與保護</h2>
      <ul>
        <li>
          會員資料存放在 Supabase（資料中心位於澳洲雪梨），網站由 Vercel 提供服務；傳輸全程使用 HTTPS 加密。
        </li>
        <li>資料庫設有權限控管，每位會員只能讀取與修改自己的資料。</li>
      </ul>

      <h2>刪除資料</h2>
      <p>
        登入後到
        <Link href="/account" className="underline underline-offset-2">
          帳號設定
        </Link>
        即可刪除帳號，自選股與策略會一併永久刪除。你也可以隨時在 Google
        帳號的「第三方應用程式」中移除本站的存取權。
      </p>

      <h2>政策變更</h2>
      <p>本政策如有修改，會更新本頁的「最後更新」日期。</p>
    </article>
  );
}
