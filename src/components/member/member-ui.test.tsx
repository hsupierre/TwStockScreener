import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { UserMenu } from "@/components/auth/user-menu";
import { fake } from "@/test/fake-supabase";
import { navigationState, routerMock } from "@/test/navigation";

import { MyScreensMenu } from "./my-screens-menu";
import { StrategiesView } from "./strategies-view";
import { WatchButton, WatchStar } from "./watch-button";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const { toast } = await import("sonner");

const ALICE = { id: "alice", email: "alice@example.com", user_metadata: { full_name: "Alice" } };
const signIn = () => {
  fake.session = { user: ALICE } as never;
};

describe("UserMenu", () => {
  it("未登入顯示登入連結，點擊時帶上目前的網址（含篩選條件）", async () => {
    window.history.replaceState(null, "", "/screener?dy=4~");
    const user = userEvent.setup();
    render(<UserMenu />);
    const link = await screen.findByRole("link", { name: "登入" });
    await user.click(link);
    expect(routerMock.push).toHaveBeenCalledWith("/login?next=%2Fscreener%3Fdy%3D4~");
    window.history.replaceState(null, "", "/");
  });

  it("登入後顯示會員選單；登出", async () => {
    signIn();
    const user = userEvent.setup();
    render(<UserMenu />);
    await user.click(await screen.findByRole("button", { name: "會員選單" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("Alice")).toBeInTheDocument();
    expect(within(menu).getByText("alice@example.com")).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "自選股" })).toHaveAttribute("href", "/watchlist");

    await user.click(within(menu).getByRole("menuitem", { name: "登出" }));
    expect(await screen.findByRole("link", { name: "登入" })).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("已登出");
  });
});

describe("WatchButton / WatchStar", () => {
  it("未登入時導向登入頁", async () => {
    window.history.replaceState(null, "", "/stocks/2330");
    const user = userEvent.setup();
    render(<WatchButton code="2330" name="台積電" />);
    const button = screen.getByRole("button", { name: "加入自選" });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    expect(routerMock.push).toHaveBeenCalledWith("/login?next=%2Fstocks%2F2330");
    window.history.replaceState(null, "", "/");
  });

  it("登入後切換，按鈕與表格星號同步", async () => {
    signIn();
    const user = userEvent.setup();
    render(
      <>
        <WatchButton code="2330" name="台積電" />
        <WatchStar code="2330" name="台積電" />
      </>,
    );
    const button = screen.getByRole("button", { name: "加入自選" });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    expect(await screen.findByRole("button", { name: "已加入自選" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "將 台積電 移出自選股" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(toast.success).toHaveBeenCalledWith("已將 台積電 加入自選股");

    await user.click(screen.getByRole("button", { name: "將 台積電 移出自選股" }));
    expect(await screen.findByRole("button", { name: "加入自選" })).toHaveAttribute("aria-pressed", "false");
  });
});

describe("MyScreensMenu", () => {
  it("儲存目前的條件，之後出現在清單並標示為目前套用中", async () => {
    signIn();
    window.history.replaceState(null, "", "/screener?dy=4~&utm_source=x");
    navigationState.search = "dy=4~";
    const user = userEvent.setup();
    render(<MyScreensMenu />);

    await user.click(screen.getByRole("button", { name: "我的策略" }));
    await user.click(await screen.findByRole("menuitem", { name: "儲存目前的條件…" }));
    const dialog = await screen.findByRole("dialog", { name: "儲存目前的條件" });
    await user.click(within(dialog).getByRole("button", { name: "儲存" }));
    expect(within(dialog).getByText("請輸入名稱")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("名稱"), "高殖利率");
    await user.click(within(dialog).getByRole("button", { name: "儲存" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fake.tables.saved_screens).toMatchObject([{ name: "高殖利率", query: "dy=4~" }]);

    await user.click(screen.getByRole("button", { name: "我的策略" }));
    const item = await screen.findByRole("menuitem", { name: "高殖利率" });
    expect(item).toHaveAttribute("href", "/screener?dy=4~");
    expect(item).toHaveAttribute("aria-current", "true");
    window.history.replaceState(null, "", "/");
  });

  it("未登入時按儲存會導向登入頁", async () => {
    window.history.replaceState(null, "", "/screener?pe=~15");
    const user = userEvent.setup();
    render(<MyScreensMenu />);
    await act(async () => {});
    await user.click(screen.getByRole("button", { name: "我的策略" }));
    await user.click(await screen.findByRole("menuitem", { name: "儲存目前的條件…" }));
    expect(routerMock.push).toHaveBeenCalledWith("/login?next=%2Fscreener%3Fpe%3D~15");
    window.history.replaceState(null, "", "/");
  });
});

describe("StrategiesView", () => {
  it("未登入時顯示登入提示", async () => {
    render(<StrategiesView />);
    expect(await screen.findByText("登入後才能使用我的策略")).toBeInTheDocument();
  });

  it("列出條件摘要，可以重新命名與刪除", async () => {
    signIn();
    fake.tables.saved_screens = [
      { id: "s1", user_id: "alice", name: "存股", query: "dy=4~&m=twse", created_at: "2026-10-20T00:00:00Z" },
    ];
    const user = userEvent.setup();
    render(<StrategiesView />);

    expect(await screen.findByRole("link", { name: "存股" })).toHaveAttribute(
      "href",
      "/screener?dy=4~&m=twse",
    );
    expect(screen.getByText("殖利率 ≥ 4%")).toBeInTheDocument();
    expect(screen.getByText("上市")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "重新命名「存股」" }));
    const input = await screen.findByLabelText("名稱");
    await user.clear(input);
    await user.type(input, "高殖利率");
    await user.click(screen.getByRole("button", { name: "儲存" }));
    expect(await screen.findByRole("link", { name: "高殖利率" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "刪除「高殖利率」" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "刪除" }));
    expect(await screen.findByText("還沒有儲存的策略")).toBeInTheDocument();
    expect(fake.tables.saved_screens).toEqual([]);
  });
});
