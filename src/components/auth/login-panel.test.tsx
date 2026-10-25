import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { fake } from "@/test/fake-supabase";
import { navigationState, routerMock } from "@/test/navigation";

import { LoginPanel } from "./login-panel";

describe("LoginPanel", () => {
  it("用 Google 登入，完成後回到 ?next= 指定的頁面", async () => {
    navigationState.search = "next=%2Fscreener%3Fdy%3D4~";
    const user = userEvent.setup();
    render(<LoginPanel />);
    const button = screen.getByRole("button", { name: /使用 Google 帳號登入/ });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    expect(fake.signInWithOAuth).toHaveBeenCalledTimes(1);
    const opts = fake.signInWithOAuth.mock.calls[0]![0] as {
      provider: string;
      options: { redirectTo: string };
    };
    expect(opts.provider).toBe("google");
    const redirect = new URL(opts.options.redirectTo);
    expect(redirect.pathname).toBe("/auth/callback");
    expect(redirect.searchParams.get("next")).toBe("/screener?dy=4~");
  });

  it("不接受站外的 next", async () => {
    navigationState.search = "next=https%3A%2F%2Fevil.com";
    const user = userEvent.setup();
    render(<LoginPanel />);
    const button = screen.getByRole("button", { name: /使用 Google 帳號登入/ });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    const opts = fake.signInWithOAuth.mock.calls[0]![0] as { options: { redirectTo: string } };
    expect(new URL(opts.options.redirectTo).searchParams.get("next")).toBe("/");
  });

  it("顯示 callback 帶回來的錯誤；無法連線時也顯示", async () => {
    navigationState.search = "error=denied";
    fake.signInWithOAuth.mockResolvedValueOnce({ data: {}, error: { message: "network" } });
    const user = userEvent.setup();
    render(<LoginPanel />);
    expect(screen.getByRole("alert")).toHaveTextContent("你取消了 Google 登入。");

    const button = screen.getByRole("button", { name: /使用 Google 帳號登入/ });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("無法連線到 Google 登入");
  });

  it("已經登入時直接回到原本的頁面", async () => {
    navigationState.search = "next=%2Fwatchlist";
    fake.session = { user: { id: "alice", user_metadata: {} } } as never;
    render(<LoginPanel />);
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/watchlist"));
  });
});
