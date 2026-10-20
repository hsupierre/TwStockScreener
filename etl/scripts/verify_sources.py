"""Phase 0：實測所有免費資料端點，輸出欄位報告。

只用標準函式庫，不需要安裝套件：
    python etl/scripts/verify_sources.py            # 輸出到 etl/reports/sources.md
    python etl/scripts/verify_sources.py --json     # 另外輸出 sources.json（給 ETL 開發參考）
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

TWSE = "https://openapi.twse.com.tw/v1"
TPEX = "https://www.tpex.org.tw/openapi/v1"
USER_AGENT = "Mozilla/5.0 (TwStockScreener source verifier)"
SAMPLE_CODES = ("2330", "2881", "6488")  # 一般業、金控業、上櫃股

# (key, 說明, URL)
ENDPOINTS: list[tuple[str, str, str]] = [
    ("twse_company", "上市公司基本資料", f"{TWSE}/opendata/t187ap03_L"),
    ("twse_quote", "上市個股日成交資訊", f"{TWSE}/exchangeReport/STOCK_DAY_ALL"),
    ("twse_valuation", "上市本益比/殖利率/淨值比", f"{TWSE}/exchangeReport/BWIBBU_ALL"),
    ("twse_revenue", "上市每月營收", f"{TWSE}/opendata/t187ap05_L"),
    ("twse_income_ci", "上市綜合損益表(一般業)", f"{TWSE}/opendata/t187ap06_L_ci"),
    ("twse_income_fh", "上市綜合損益表(金控業)", f"{TWSE}/opendata/t187ap06_L_fh"),
    ("twse_balance_ci", "上市資產負債表(一般業)", f"{TWSE}/opendata/t187ap07_L_ci"),
    ("twse_balance_fh", "上市資產負債表(金控業)", f"{TWSE}/opendata/t187ap07_L_fh"),
    ("twse_margin", "上市營益分析", f"{TWSE}/opendata/t187ap17_L"),
    ("twse_dividend", "上市股利分派", f"{TWSE}/opendata/t187ap45_L"),
    ("tpex_company", "上櫃基本資料", f"{TPEX}/mopsfin_t187ap03_O"),
    ("tpex_quote", "上櫃行情", f"{TPEX}/tpex_mainboard_daily_close_quotes"),
    ("tpex_valuation", "上櫃本益比/殖利率/淨值比", f"{TPEX}/tpex_mainboard_peratio_analysis"),
    ("tpex_revenue", "上櫃每月營收", f"{TPEX}/mopsfin_t187ap05_O"),
    ("tpex_income_ci", "上櫃綜合損益表(一般業)", f"{TPEX}/mopsfin_t187ap06_O_ci"),
    ("tpex_balance_ci", "上櫃資產負債表(一般業)", f"{TPEX}/mopsfin_t187ap07_O_ci"),
    ("tpex_margin", "上櫃營益分析", f"{TPEX}/mopsfin_187ap17_O"),
    ("tpex_dividend", "上櫃股利分派", f"{TPEX}/mopsfin_t187ap39_O"),
]

# 歷史回補候選：MOPS 彙總報表（POST，回傳 HTML 表格）
MOPS_PROBES: list[tuple[str, str, str, dict[str, str]]] = [
    (
        "mopsov_income_sii",
        "MOPS(舊站) 綜合損益彙總表 上市 113Q1",
        "https://mopsov.twse.com.tw/mops/web/ajax_t163sb04",
        {
            "encodeURIComponent": "1",
            "step": "1",
            "firstin": "1",
            "off": "1",
            "isQuery": "Y",
            "TYPEK": "sii",
            "year": "113",
            "season": "01",
        },
    ),
]

CODE_KEYS = ("公司代號", "Code", "SecuritiesCompanyCode", "CompanyCode", "股票代號", "證券代號")


@dataclass
class Result:
    key: str
    label: str
    url: str
    ok: bool = False
    status: int | None = None
    seconds: float = 0.0
    rows: int = 0
    fields: list[str] = field(default_factory=list)
    samples: dict[str, dict] = field(default_factory=dict)
    note: str = ""


def fetch(url: str, data: dict[str, str] | None = None, timeout: int = 90) -> tuple[int, bytes, float]:
    body = urllib.parse.urlencode(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    started = time.perf_counter()
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read(), time.perf_counter() - started


def find_code(row: dict) -> str | None:
    for k in CODE_KEYS:
        if k in row:
            return str(row[k]).strip()
    return None


def probe_json(key: str, label: str, url: str) -> Result:
    r = Result(key, label, url)
    try:
        r.status, raw, r.seconds = fetch(url)
        rows = json.loads(raw.decode("utf-8-sig"))
        if not isinstance(rows, list):
            r.note = f"回傳不是陣列：{type(rows).__name__}"
            return r
        r.rows = len(rows)
        if rows:
            r.fields = list(rows[0].keys())
            for row in rows:
                code = find_code(row)
                if code in SAMPLE_CODES:
                    r.samples[code] = row
        r.ok = r.rows > 0
        if not r.ok:
            r.note = "空陣列"
    except urllib.error.HTTPError as e:
        r.status, r.note = e.code, f"HTTP {e.code}"
    except Exception as e:
        r.note = f"{type(e).__name__}: {e}"
    return r


def probe_mops(key: str, label: str, url: str, form: dict[str, str]) -> Result:
    r = Result(key, label, url)
    try:
        r.status, raw, r.seconds = fetch(url, form)
        html = raw.decode("utf-8", errors="replace")
        r.rows = html.count("<tr")
        r.ok = "2330" in html
        r.note = f"HTML {len(html):,} 字元，<tr> {r.rows} 個，含 2330：{r.ok}"
        if not r.ok:
            r.note += f"；開頭：{html[:200]!r}"
    except urllib.error.HTTPError as e:
        r.status, r.note = e.code, f"HTTP {e.code}"
    except Exception as e:
        r.note = f"{type(e).__name__}: {e}"
    return r


def render_markdown(results: list[Result]) -> str:
    now = datetime.now(UTC).astimezone().strftime("%Y-%m-%d %H:%M %Z")
    lines = [
        f"# 資料來源驗證報告\n\n產生時間：{now}\n",
        "| 狀態 | key | 說明 | 筆數 | 秒數 | 備註 |",
        "|---|---|---|---|---|---|",
    ]
    for r in results:
        lines.append(f"| {'✅' if r.ok else '❌'} | `{r.key}` | {r.label} | {r.rows:,} | {r.seconds:.1f} | {r.note} |")
    for r in results:
        if not r.fields:
            continue
        lines += [f"\n## `{r.key}` {r.label}\n", f"`{r.url}`\n", "欄位：" + "、".join(f"`{f}`" for f in r.fields)]
        for code, row in r.samples.items():
            lines.append(f"\n樣本 {code}：\n```json\n{json.dumps(row, ensure_ascii=False, indent=1)}\n```")
    return "\n".join(lines) + "\n"


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true", help="另外輸出 sources.json")
    ap.add_argument("--out", type=Path, default=Path(__file__).resolve().parents[1] / "reports")
    args = ap.parse_args()

    results: list[Result] = []
    for key, label, url in ENDPOINTS:
        r = probe_json(key, label, url)
        print(f"{'OK ' if r.ok else 'ERR'} {key:18} rows={r.rows:<6} {r.seconds:5.1f}s {r.note}")
        results.append(r)
        time.sleep(1)  # 對官方伺服器保持禮貌
    for key, label, url, form in MOPS_PROBES:
        r = probe_mops(key, label, url, form)
        print(f"{'OK ' if r.ok else 'ERR'} {key:18} {r.note[:120]}")
        results.append(r)

    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "sources.md").write_text(render_markdown(results), encoding="utf-8")
    if args.json:
        payload = [r.__dict__ for r in results]
        (args.out / "sources.json").write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    failed = [r.key for r in results if not r.ok]
    print(f"\n完成：{len(results) - len(failed)}/{len(results)} 成功；報告在 {args.out / 'sources.md'}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
