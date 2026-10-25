"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { createMemberResource, type ResourceState } from "./resource";
import { memberErrorMessage } from "./store";

export const WATCHLIST_LIMIT = 200;
const LIMIT_MESSAGE = `自選股最多 ${WATCHLIST_LIMIT} 檔`;

const table = () => createSupabaseBrowserClient().from("watchlist_items");

/** 代號清單，依加入順序。 */
const watchlist = createMemberResource<readonly string[]>([], async () => {
  const { data, error } = await table().select("code").order("created_at");
  return { data: data?.map((r) => r.code) ?? null, error };
});

export type WatchlistState = ResourceState<readonly string[]>;
export const useWatchlist = watchlist.use;
export const reloadWatchlist = watchlist.reload;
export const resetWatchlistForTest = watchlist.resetForTest;

export type ToggleResult = { ok: true; added: boolean } | { ok: false; message: string };

/** 加入或移除；先更新畫面（樂觀更新），失敗時還原。 */
export async function toggleWatch(code: string): Promise<ToggleResult> {
  const s = watchlist.ready();
  if (!s) return { ok: false, message: "請先登入" };
  const adding = !s.data.includes(code);
  if (adding && s.data.length >= WATCHLIST_LIMIT) return { ok: false, message: LIMIT_MESSAGE };

  const update = (add: boolean) =>
    watchlist.store.set((prev) => ({
      ...prev,
      data: add ? [...prev.data.filter((c) => c !== code), code] : prev.data.filter((c) => c !== code),
    }));

  update(adding);
  const { error } = adding
    ? await table().insert({ code })
    : await table().delete().eq("user_id", s.userId).eq("code", code);

  // 23505：已經在清單中（例如另一個分頁剛加入），視為成功
  if (!error || (adding && error.code === "23505")) return { ok: true, added: adding };
  update(!adding);
  return { ok: false, message: memberErrorMessage(error, LIMIT_MESSAGE) };
}
