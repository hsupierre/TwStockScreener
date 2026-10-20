import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-2xl font-bold">找不到這個頁面</h1>
      <p className="text-muted-foreground">網址可能有誤，或這檔股票已經下市。</p>
      <Button asChild>
        <Link href="/">回首頁</Link>
      </Button>
    </div>
  );
}
