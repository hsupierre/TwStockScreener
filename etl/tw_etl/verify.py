"""資料正確性交叉驗證：用資料庫裡的單季值重組「年度累計」毛利率等指標，與官方「營益分析」比對。

官方營益分析是最新一季的年度累計值（例如 Q2 = 上半年），所以這裡把 Q1..Qn 單季值加總後計算。
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from .sources import openapi
from .transform.snapshot import pct

if TYPE_CHECKING:
    from .jobs import Context

log = logging.getLogger(__name__)

TOLERANCE = 0.05  # 百分點；官方數字四捨五入到小數 2 位


def verify_margins(ctx: Context, *, max_mismatch_ratio: float = 0.01) -> int:
    official = openapi.fetch_official_margins(ctx.fetcher)
    periods = {(v["year"], v["quarter"]) for v in official.values() if v["year"] and v["quarter"]}
    roc_year, quarter = max(periods)  # type: ignore[type-var]
    year = roc_year + 1911
    rows = ctx.db.select_all(
        "financials_quarterly",
        select="code,quarter,report_type,revenue,gross_profit,operating_income,net_income",
        order="code,quarter",
        filters={"year": f"eq.{year}", "quarter": f"lte.{quarter}"},
    )
    cumulative: dict[str, dict[str, float]] = {}
    counts: dict[str, int] = {}
    for r in rows:
        if r["report_type"] not in ("ci", None):
            continue
        acc = cumulative.setdefault(
            r["code"], {"revenue": 0, "gross_profit": 0, "operating_income": 0, "net_income": 0}
        )
        if any(r[k] is None for k in acc):
            acc["invalid"] = 1
            continue
        for k in ("revenue", "gross_profit", "operating_income", "net_income"):
            acc[k] += r[k]
        counts[r["code"]] = counts.get(r["code"], 0) + 1

    compared = mismatched = 0
    examples: list[str] = []
    for code, acc in cumulative.items():
        o = official.get(code)
        if not o or "invalid" in acc or counts.get(code) != quarter or (o["year"], o["quarter"]) != (roc_year, quarter):
            continue
        for metric, num in (("gross_margin", "gross_profit"), ("operating_margin", "operating_income")):
            ours, theirs = pct(acc[num], acc["revenue"]), o[metric]
            if ours is None or theirs is None:
                continue
            compared += 1
            if abs(ours - theirs) > TOLERANCE:
                mismatched += 1
                if len(examples) < 10:
                    examples.append(f"{code} {metric}: 計算 {ours:.2f} vs 官方 {theirs:.2f}")
    ratio = mismatched / compared if compared else 1.0
    print(f"比對 {year}Q{quarter} 累計：{compared} 項，不一致 {mismatched} 項（{ratio:.2%}）")
    for e in examples:
        print("  ", e)
    return 0 if compared > 1000 and ratio <= max_mismatch_ratio else 1
