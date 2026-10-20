from scripts.verify_sources import ENDPOINTS, Result, find_code, render_markdown


def test_find_code_supports_twse_and_tpex_keys():
    assert find_code({"公司代號": "2330 "}) == "2330"
    assert find_code({"Code": "2881"}) == "2881"
    assert find_code({"SecuritiesCompanyCode": "6488"}) == "6488"
    assert find_code({"其他": "x"}) is None


def test_endpoint_keys_are_unique_and_https():
    keys = [k for k, _, _ in ENDPOINTS]
    assert len(keys) == len(set(keys))
    assert all(url.startswith("https://") for _, _, url in ENDPOINTS)


def test_render_markdown_lists_status_fields_and_samples():
    ok = Result("a", "甲", "https://x/a", ok=True, rows=2, fields=["公司代號", "EPS"], samples={"2330": {"EPS": "1"}})
    bad = Result("b", "乙", "https://x/b", note="HTTP 500")
    md = render_markdown([ok, bad])
    assert "| ✅ | `a` | 甲 | 2 |" in md
    assert "| ❌ | `b` | 乙 | 0 |" in md
    assert "`公司代號`、`EPS`" in md
    assert "樣本 2330" in md
