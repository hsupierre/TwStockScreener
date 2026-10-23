"use client";

import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface IndustryFilterProps {
  industries: readonly string[];
  value: readonly string[];
  onChange: (value: string[]) => void;
}

export function IndustryFilter({ industries, value, onChange }: IndustryFilterProps) {
  const selected = new Set(value);
  const toggle = (name: string) =>
    onChange(selected.has(name) ? value.filter((v) => v !== name) : [...value, name]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          // combobox 角色不會以內文當作名稱，需要明確的 aria-label
          aria-label={value.length === 0 ? "產業：全部" : `產業：${value.join("、")}`}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {value.length === 0
              ? "全部產業"
              : value.length <= 2
                ? value.join("、")
                : `已選 ${value.length} 個產業`}
          </span>
          <ChevronsUpDown className="size-4 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="搜尋產業…" />
          <CommandList>
            <CommandEmpty>找不到產業</CommandEmpty>
            <CommandGroup>
              {industries.map((name) => (
                <CommandItem key={name} value={name} onSelect={() => toggle(name)}>
                  <Check
                    className={cn("size-4", selected.has(name) ? "opacity-100" : "opacity-0")}
                    aria-hidden
                  />
                  {name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {value.length > 0 && (
            <div className="border-t p-1">
              <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange([])}>
                清除產業條件
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
