"""透過 PostgREST（Supabase REST API）讀寫資料。使用 service_role key，會略過 RLS。"""

from __future__ import annotations

import json
import logging
from collections.abc import Iterable, Iterator, Sequence
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import httpx

log = logging.getLogger(__name__)

PAGE_SIZE = 1000  # Supabase 預設 max_rows


class SupabaseError(RuntimeError):
    pass


def _json_default(value: Any) -> Any:
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    raise TypeError(f"無法序列化 {type(value).__name__}")


def _chunks(rows: Sequence[dict[str, Any]], size: int) -> Iterator[Sequence[dict[str, Any]]]:
    for i in range(0, len(rows), size):
        yield rows[i : i + size]


def in_filter(values: Iterable[str]) -> str:
    """PostgREST 的 in.(...) 篩選值。"""
    quoted = ",".join(f'"{v}"' for v in values)
    return f"in.({quoted})"


class Supabase:
    def __init__(self, url: str, key: str, *, client: httpx.Client | None = None) -> None:
        headers = {"apikey": key, "Content-Type": "application/json"}
        if not key.startswith("sb_"):  # 舊版 JWT key 也要放在 Authorization
            headers["Authorization"] = f"Bearer {key}"
        self._client = client or httpx.Client(timeout=120.0)
        self._base = f"{url}/rest/v1"
        self._headers = headers

    def close(self) -> None:
        self._client.close()

    def _send(self, method: str, path: str, *, params=None, body=None, headers=None) -> httpx.Response:
        content = json.dumps(body, default=_json_default, ensure_ascii=False) if body is not None else None
        resp = self._client.request(
            method,
            f"{self._base}/{path}",
            params=params,
            content=content,
            headers={**self._headers, **(headers or {})},
        )
        if resp.status_code >= 400:
            raise SupabaseError(f"{method} {path} → HTTP {resp.status_code}: {resp.text[:500]}")
        return resp

    def upsert(self, table: str, rows: Sequence[dict[str, Any]], *, on_conflict: str, chunk: int = 500) -> int:
        """批次 upsert。PostgREST 要求同一批的欄位一致，所以依欄位組合分組送出。"""
        if not rows:
            return 0
        groups: dict[tuple[str, ...], list[dict[str, Any]]] = {}
        for row in rows:
            groups.setdefault(tuple(sorted(row)), []).append(row)
        written = 0
        for batch_rows in groups.values():
            for batch in _chunks(batch_rows, chunk):
                self._send(
                    "POST",
                    table,
                    params={"on_conflict": on_conflict},
                    body=list(batch),
                    headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
                )
                written += len(batch)
        log.info("upsert %s：%d 列", table, written)
        return written

    def insert(self, table: str, row: dict[str, Any]) -> dict[str, Any]:
        resp = self._send("POST", table, body=row, headers={"Prefer": "return=representation"})
        return resp.json()[0]

    def update(self, table: str, filters: dict[str, str], values: dict[str, Any]) -> None:
        self._send("PATCH", table, params=filters, body=values, headers={"Prefer": "return=minimal"})

    def delete(self, table: str, filters: dict[str, str]) -> None:
        if not filters:
            raise ValueError("delete 必須帶篩選條件")
        self._send("DELETE", table, params=filters, headers={"Prefer": "return=minimal"})

    def select_all(self, table: str, *, select: str = "*", order: str, filters: dict[str, str] | None = None) -> list:
        """分頁讀取全部符合條件的列（每頁 1,000 列）。order 必須能唯一排序，否則分頁可能重複或遺漏。"""
        out: list[dict[str, Any]] = []
        start = 0
        while True:
            resp = self._send(
                "GET",
                table,
                params={"select": select, "order": order, **(filters or {})},
                headers={"Range-Unit": "items", "Range": f"{start}-{start + PAGE_SIZE - 1}"},
            )
            page = resp.json()
            out.extend(page)
            if len(page) < PAGE_SIZE:
                return out
            start += PAGE_SIZE
