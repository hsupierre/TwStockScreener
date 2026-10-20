import httpx
import pytest

from tw_etl.http import Fetcher, FetchError

WAF_PAGE = (
    "<html><body>因為安全性考量，您所執行的頁面無法呈現。<BR>"
    "FOR SECURITY REASONS, THIS PAGE CAN NOT BE ACCESSED.</body></html>"
)


def make_fetcher(responses: list[httpx.Response], sleeps: list[float], retries: int = 3) -> Fetcher:
    queue = iter(responses)

    def handler(request: httpx.Request) -> httpx.Response:
        return next(queue)

    return Fetcher(transport=httpx.MockTransport(handler), sleep=sleeps.append, retries=retries)


def test_retries_waf_block_with_long_delay_then_succeeds():
    sleeps: list[float] = []
    f = make_fetcher([httpx.Response(200, text=WAF_PAGE), httpx.Response(200, json=[{"Code": "2330"}])], sleeps)
    assert f.get_json("https://openapi.twse.com.tw/v1/x") == [{"Code": "2330"}]
    assert max(sleeps) >= 120


def test_retries_server_errors_then_gives_up():
    sleeps: list[float] = []
    f = make_fetcher([httpx.Response(503)] * 3, sleeps, retries=2)
    with pytest.raises(FetchError, match="重試 2 次仍失敗"):
        f.get_text("https://www.tpex.org.tw/openapi/v1/x")


def test_client_error_is_not_retried():
    sleeps: list[float] = []
    f = make_fetcher([httpx.Response(404)], sleeps)
    with pytest.raises(FetchError, match="HTTP 404"):
        f.get_text("https://mopsov.twse.com.tw/nas/t21/sii/missing.html")


def test_non_json_response_raises_fetch_error():
    f = make_fetcher([httpx.Response(200, text="<html>維護中</html>")], [])
    with pytest.raises(FetchError, match="不是 JSON"):
        f.get_json("https://openapi.twse.com.tw/v1/x")
