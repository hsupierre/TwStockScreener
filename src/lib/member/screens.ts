"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database";

import { createMemberResource, type ResourceState } from "./resource";
import { memberErrorMessage } from "./store";

export const SCREENS_LIMIT = 50;
export const SCREEN_NAME_MAX = 40;
const LIMIT_MESSAGE = `我的策略最多 ${SCREENS_LIMIT} 個`;

export type SavedScreen = Pick<
  Tables<"saved_screens">,
  "id" | "name" | "query" | "created_at" | "updated_at"
>;
export type MutationResult<T = void> = { ok: true; value: T } | { ok: false; message: string };

const COLUMNS = "id, name, query, created_at, updated_at";
const table = () => createSupabaseBrowserClient().from("saved_screens");

/** 依建立時間排序。 */
const screens = createMemberResource<readonly SavedScreen[]>([], () =>
  table().select(COLUMNS).order("created_at"),
);

export type ScreensState = ResourceState<readonly SavedScreen[]>;
export const useSavedScreens = screens.use;
export const reloadScreens = screens.reload;
export const resetScreensForTest = screens.resetForTest;

/** 名稱去掉前後空白後檢查；有問題時回傳錯誤訊息。 */
export function validateScreenName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "請輸入名稱";
  if (trimmed.length > SCREEN_NAME_MAX) return `名稱最多 ${SCREEN_NAME_MAX} 個字`;
  return null;
}

export async function createScreen(name: string, query: string): Promise<MutationResult<SavedScreen>> {
  const s = screens.ready();
  if (!s) return { ok: false, message: "請先登入" };
  const invalid = validateScreenName(name);
  if (invalid) return { ok: false, message: invalid };
  if (s.data.length >= SCREENS_LIMIT) return { ok: false, message: LIMIT_MESSAGE };

  const { data, error } = await table().insert({ name: name.trim(), query }).select(COLUMNS).single();
  if (error) return { ok: false, message: memberErrorMessage(error, LIMIT_MESSAGE) };
  screens.store.set((prev) => ({ ...prev, data: [...prev.data, data] }));
  return { ok: true, value: data };
}

export async function renameScreen(id: string, name: string): Promise<MutationResult> {
  if (!screens.ready()) return { ok: false, message: "請先登入" };
  const invalid = validateScreenName(name);
  if (invalid) return { ok: false, message: invalid };

  const { data, error } = await table().update({ name: name.trim() }).eq("id", id).select(COLUMNS).single();
  if (error) return { ok: false, message: memberErrorMessage(error) };
  screens.store.set((prev) => ({ ...prev, data: prev.data.map((it) => (it.id === id ? data : it)) }));
  return { ok: true, value: undefined };
}

export async function deleteScreen(id: string): Promise<MutationResult> {
  if (!screens.ready()) return { ok: false, message: "請先登入" };
  const { error } = await table().delete().eq("id", id);
  if (error) return { ok: false, message: memberErrorMessage(error) };
  screens.store.set((prev) => ({ ...prev, data: prev.data.filter((it) => it.id !== id) }));
  return { ok: true, value: undefined };
}
