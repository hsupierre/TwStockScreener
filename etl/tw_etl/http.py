"""對官方網站的 HTTP 存取：依主機節流、逾時重試、偵測 MOPS「查詢過於頻繁」。"""

from __future__ import annotations

import logging
import time
from collections.abc import Callable
from typing import Any
from urllib.parse import urlparse

import httpx

log = logging.getLogger(__name__)

USER_AGENT = "Mozilla/5.0 (compatible; TwStockScreener-ETL/0.1; +https://github.com/)"

# 每個主機兩次請求之間的最短間隔（秒）。MOPS 對頻繁查詢很敏感。
MIN_INTERVAL: dict[str, float] = {
    "mopsov.twse.com.tw": 3.0,
    "mops.twse.com.tw": 3.0,
}
DEFAULT_INTERVAL = 0.5

MOPS_OVERLOAD_MARKERS = ("查詢過於頻繁", "Overrun", "請稍後再查詢")
# 證交所（含 openapi、mopsov）的 WAF 封鎖頁：HTTP 200 但內容是 HTML，通常數分鐘到數小時後解除
WAF_BLOCK_MARKERS = ("FOR SECURITY REASONS", "因為安全性考量")
WAF_MIN_DELAY = 120.0


class FetchError(RuntimeError):
    pass


class _Retryable(Exception):
    pass


class Fetcher:
    def __init__(
        self,
        *,
        timeout: float = 90.0,
        retries: int = 4,
        backoff: float = 5.0,
        transport: httpx.BaseTransport | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._client = httpx.Client(
            headers={"User-Agent": USER_AGENT, "Accept": "*/*"},
            timeout=timeout,
            follow_redirects=True,
            transport=transport,
        )
        self._retries = retries
        self._backoff = backoff
        self._sleep = sleep
        self._last_request: dict[str, float] = {}
        self._intervals: dict[str, float] = dict(MIN_INTERVAL)

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> Fetcher:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def _throttle(self, host: str) -> None:
        wait = self._intervals.get(host, DEFAULT_INTERVAL) - (time.monotonic() - self._last_request.get(host, 0.0))
        if wait > 0:
            self._sleep(wait)
        self._last_request[host] = time.monotonic()

    def _request(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        host = urlparse(url).hostname or ""
        last_error: Exception | None = None
        for attempt in range(self._retries + 1):
            self._throttle(host)
            try:
                resp = self._client.request(method, url, **kwargs)
                if resp.status_code == 429 or resp.status_code >= 500:
                    raise _Retryable(f"HTTP {resp.status_code}")
                resp.raise_for_status()
                head = resp.text[:3000]
                if any(m in head for m in WAF_BLOCK_MARKERS):
                    raise _Retryable("被網站安全機制（WAF）暫時封鎖")
                if "mops" in host and any(m in head for m in MOPS_OVERLOAD_MARKERS):
                    raise _Retryable("MOPS 查詢過於頻繁")
                return resp
            except (httpx.TransportError, _Retryable) as e:
                last_error = e
                if attempt == self._retries:
                    break
                delay = self._backoff * (2**attempt)
                if "WAF" in str(e):
                    delay = max(delay, WAF_MIN_DELAY * (attempt + 1))
                elif "頻繁" in str(e):
                    delay = max(delay, 60.0)
                log.warning("%s %s 失敗（%s），%.0f 秒後重試 %d/%d", method, url, e, delay, attempt + 1, self._retries)
                self._sleep(delay)
            except httpx.HTTPStatusError as e:
                raise FetchError(f"{method} {url} → HTTP {e.response.status_code}") from e
        raise FetchError(f"{method} {url} 重試 {self._retries} 次仍失敗：{last_error}")

    def set_min_interval(self, host: str, seconds: float) -> None:
        """調整單一主機的最短請求間隔（例如依 FinMind 的額度）。"""
        self._intervals[host] = seconds

    def get_json(self, url: str, params: dict[str, Any] | None = None, headers: dict[str, str] | None = None) -> Any:
        resp = self._request("GET", url, params=params, headers=headers)
        try:
            return resp.json()
        except ValueError as e:
            raise FetchError(f"{url} 回傳的不是 JSON：{resp.text[:200]!r}") from e

    def get_text(self, url: str, *, encoding: str | None = None) -> str:
        resp = self._request("GET", url)
        return resp.content.decode(encoding or resp.encoding or "utf-8", errors="replace")

    def post_form(self, url: str, data: dict[str, Any], *, encoding: str | None = None) -> str:
        resp = self._request("POST", url, data=data)
        return resp.content.decode(encoding or resp.encoding or "utf-8", errors="replace")
