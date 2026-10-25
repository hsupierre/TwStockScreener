"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SCREEN_NAME_MAX, validateScreenName } from "@/lib/member/screens";

/** 輸入策略名稱的對話框（新增與重新命名共用）。 */
export function ScreenNameDialog({
  open,
  onOpenChange,
  title,
  description,
  initialName = "",
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  initialName?: string;
  submitLabel: string;
  /** 回傳錯誤訊息時留在對話框並顯示；回傳 null 代表成功並關閉 */
  onSubmit: (name: string) => Promise<string | null>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* 每次開啟都重新掛載表單，名稱與錯誤訊息回到初始值 */}
        {open && (
          <NameForm
            title={title}
            description={description}
            initialName={initialName}
            submitLabel={submitLabel}
            onSubmit={onSubmit}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function NameForm({
  title,
  description,
  initialName,
  submitLabel,
  onSubmit,
  onDone,
}: {
  title: string;
  description?: string;
  initialName: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<string | null>;
  onDone: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const invalid = validateScreenName(name);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    const message = await onSubmit(name);
    setBusy(false);
    if (message) setError(message);
    else onDone();
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="screen-name" className="text-sm font-medium">
          名稱
        </label>
        <Input
          id="screen-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          maxLength={SCREEN_NAME_MAX}
          placeholder="例如：高殖利率低本益比"
          autoFocus
          aria-invalid={!!error}
          aria-describedby={error ? "screen-name-error" : undefined}
        />
        {error && (
          <p id="screen-name-error" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="submit" disabled={busy}>
          {busy ? "儲存中…" : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
