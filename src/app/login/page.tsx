import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { LoginPanel } from "@/components/auth/login-panel";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "登入",
  description: "登入後可以建立自選股清單、儲存自己的選股策略。",
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">登入會員</h1>
        <p className="text-muted-foreground">登入後可以：</p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>把關注的股票加入自選股，一頁看完重點指標</li>
          <li>把選股條件存成「我的策略」，下次一鍵套用</li>
        </ul>
      </div>
      {/* 讀取 ?next= 與 ?error=，必須在 Suspense 內 */}
      <Suspense
        fallback={
          <Button size="lg" disabled>
            使用 Google 帳號登入
          </Button>
        }
      >
        <LoginPanel />
      </Suspense>
      <p className="text-xs text-muted-foreground">
        登入即表示你同意本站依
        <Link href="/privacy" className="underline underline-offset-2">
          隱私權政策
        </Link>
        處理你的 Email 與名稱。本站不會取得你的 Google 密碼。
      </p>
    </div>
  );
}
