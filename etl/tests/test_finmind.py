from datetime import date

import httpx

from tw_etl.http import Fetcher
from tw_etl.sources import finmind


def fetcher(handler) -> Fetcher:
    return Fetcher(transport=httpx.MockTransport(handler), sleep=lambda s: None, retries=0)


def test_fill_prices_uses_latest_row_and_token_header():
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append((request.url.params["data_id"], request.headers.get("authorization")))
        return httpx.Response(
            200,
            json={
                "status": 200,
                "data": [
                    {"date": "2026-10-21", "close": 2420.0, "spread": 15.0, "Trading_Volume": 1, "Trading_money": 2},
                    {"date": "2026-10-22", "close": 2385.0, "spread": -35.0, "Trading_Volume": 3, "Trading_money": 4},
                ],
            },
        )

    rows = finmind.fill_prices(fetcher(handler), ["2330"], date(2026, 10, 12), token="tok")
    assert rows == [
        {
            "code": "2330",
            "trade_date": date(2026, 10, 22),
            "close": 2385.0,
            "change": -35.0,
            "volume": 3,
            "trade_value": 4,
            "source": "finmind",
        }
    ]
    assert seen == [("2330", "Bearer tok")]


def test_fill_prices_stops_when_quota_exceeded_and_skips_errors():
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        code = request.url.params["data_id"]
        calls.append(code)
        if code == "1101":
            return httpx.Response(200, json={"status": 400, "msg": "data_id error"})
        if code == "2317":
            return httpx.Response(200, json={"status": 402, "msg": "Requests reach the upper limit."})
        return httpx.Response(200, json={"status": 200, "data": [{"date": "2026-10-22", "close": 10.0}]})

    rows = finmind.fill_prices(fetcher(handler), ["2330", "1101", "2317", "2454"], date(2026, 10, 12), token=None)
    assert [r["code"] for r in rows] == ["2330"]
    assert calls == ["2330", "1101", "2317"]  # 額度用完後不再請求 2454
