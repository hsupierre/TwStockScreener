import type { Metadata } from "next";

import { AccountView } from "@/components/member/account-view";

export const metadata: Metadata = {
  title: "帳號設定",
  robots: { index: false },
};

export default function AccountPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold">帳號設定</h1>
      <AccountView />
    </div>
  );
}
