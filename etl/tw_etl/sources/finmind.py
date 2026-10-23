"""FinMind（降級模式）：官網與 OpenAPI 都失敗時，逐檔補市值較大股票的最新收盤價。

免費版不能一次查詢全市場（回應「Your level is free」），只能逐檔查詢，額度約每小時 600 次（有 token）
或 300 次（沒有 token），所以只用來補最重要的一部分股票；只提供收盤價，不提供本益比等估值。
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Any

from ..http import Fetcher, FetchError
from ..parse import positive_or_none, to_float, to_int

log = logging.getLogger(__name__)

API = "https://api.finmindtrade.com/api/v4/data"
HOST = "api.finmindtrade.com"


class QuotaExceeded(RuntimeError):
    pass


def configure(f: Fetcher, token: str | None) -> None:
    """依額度設定請求間隔：有 token 約 600 次／小時，沒有約 300 次／小時（各留一點餘裕）。"""
    f.set_min_interval(HOST, 6.5 if token else 12.5)


def latest_price(f: Fetcher, code: str, since: date, token: str | None) -> dict[str, Any] | None:
    headers = {"Authorization": f"Bearer {token}"} if token else None
    payload = f.get_json(
        API,
        params={"dataset": "TaiwanStockPrice", "data_id": code, "start_date": since.isoformat()},
        headers=headers,
    )
    status = payload.get("status")
    if status != 200:
        msg = str(payload.get("msg", ""))
        if status in (402, 429) or "limit" in msg.lower():
            raise QuotaExceeded(msg)
        raise FetchError(f"FinMind {code} → status {status}: {msg[:120]}")
    data = payload.get("data") or []
    if not data:
        return None
    last = max(data, key=lambda r: r["date"])
    return {
        "code": code,
        "trade_date": date.fromisoformat(last["date"]),
        "close": positive_or_none(last.get("close")),
        "change": to_float(last.get("spread")),
        "volume": to_int(last.get("Trading_Volume")),
        "trade_value": to_int(last.get("Trading_money")),
        "source": "finmind",
    }


def fill_prices(f: Fetcher, codes: list[str], since: date, token: str | None) -> list[dict[str, Any]]:
    """依序補價；額度用完就停止，回傳已取得的部分。"""
    configure(f, token)
    out: list[dict[str, Any]] = []
    for i, code in enumerate(codes, 1):
        try:
            row = latest_price(f, code, since, token)
        except QuotaExceeded as e:
            log.warning("FinMind 額度用完（已補 %d 檔）：%s", len(out), e)
            break
        except FetchError as e:
            log.warning("FinMind %s 失敗：%s", code, e)
            continue
        if row:
            out.append(row)
        if i % 50 == 0:
            log.info("FinMind 降級模式進度：%d/%d", i, len(codes))
    return out
