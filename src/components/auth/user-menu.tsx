"use client";

import { LogIn, LogOut, Settings, SlidersHorizontal, Star } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { loginHref } from "@/lib/auth/redirect";
import { type Member, signOut, useAuth } from "@/lib/auth/session";

/** header 右上角：未登入顯示「登入」，登入後顯示頭像選單。 */
export function UserMenu() {
  const auth = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (auth.status === "loading") {
    return <div className="size-8 animate-pulse rounded-full bg-muted" aria-label="讀取登入狀態" />;
  }
  if (auth.status === "signedOut") {
    return (
      <Button asChild variant="outline" size="sm">
        <Link
          href={loginHref(pathname) as Route}
          onClick={(e) => {
            // 點擊時才讀完整網址，選股器的篩選條件（查詢字串）登入後才會保留
            e.preventDefault();
            router.push(loginHref(window.location.pathname + window.location.search) as Route);
          }}
        >
          <LogIn aria-hidden />
          登入
        </Link>
      </Button>
    );
  }

  const { member } = auth;
  async function logout() {
    await signOut();
    toast.success("已登出");
    if (pathname.startsWith("/account")) router.push("/");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="會員選單">
          <Avatar member={member} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
          <span className="truncate font-medium">{member.name ?? "會員"}</span>
          {member.email && <span className="truncate text-xs text-muted-foreground">{member.email}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/watchlist">
            <Star aria-hidden />
            自選股
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/strategies">
            <SlidersHorizontal aria-hidden />
            我的策略
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account">
            <Settings aria-hidden />
            帳號設定
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut aria-hidden />
          登出
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Avatar({ member }: { member: Member }) {
  const initial = (member.name ?? member.email ?? "?").trim().charAt(0).toUpperCase();
  if (member.avatarUrl) {
    return (
      // Google 頭像網址不固定，不經過 next/image 最佳化（也不用設定 remotePatterns）
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={member.avatarUrl}
        alt=""
        width={32}
        height={32}
        referrerPolicy="no-referrer"
        className="size-8 rounded-full"
      />
    );
  }
  return (
    <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
      {initial}
    </span>
  );
}
