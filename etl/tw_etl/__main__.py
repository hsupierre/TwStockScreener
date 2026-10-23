"""命令列入口。

    python -m tw_etl daily                  # 公司、行情、估值 → 快照
    python -m tw_etl monthly                # 最新月營收 → 快照
    python -m tw_etl quarterly [--years 2025 2026]
    python -m tw_etl dividends [--years 2025 2026]   # 董事會決議年度
    python -m tw_etl snapshot               # 只重算快照
    python -m tw_etl backfill --from-year 2023 --revenue-months 36 --dividend-years 10 --price-days 45
    python -m tw_etl backfill --steps prices          # 只回補收盤行情（20 日均量）
    python -m tw_etl verify-margins         # 與官方「營益分析」交叉比對

所有指令都支援 --dry-run（抓取與計算，但不寫入資料庫）與 -v，放在子指令之後，例如 `daily --dry-run`。
"""

from __future__ import annotations

import argparse
import logging
import os
import sys

from .config import Settings
from .http import Fetcher
from .jobs import Context, run_backfill, run_daily, run_dividends, run_monthly, run_quarterly, run_snapshot
from .load.supabase import Supabase
from .runs import RECORDED, render_summary
from .verify import verify_margins

BACKFILL_STEPS = ("daily", "quarterly", "revenue", "dividend", "prices")


def build_parser() -> argparse.ArgumentParser:
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--dry-run", action="store_true", help="只抓取與計算，不寫入資料庫")
    common.add_argument("-v", "--verbose", action="store_true")

    p = argparse.ArgumentParser(prog="tw_etl", description="台股選股平台 ETL")
    sub = p.add_subparsers(dest="command", required=True)
    sub.add_parser("daily", parents=[common])
    sub.add_parser("monthly", parents=[common])
    q = sub.add_parser("quarterly", parents=[common])
    q.add_argument("--years", type=int, nargs="+")
    d = sub.add_parser("dividends", parents=[common])
    d.add_argument("--years", type=int, nargs="+", help="董事會決議年度（西元）")
    sub.add_parser("snapshot", parents=[common])
    b = sub.add_parser("backfill", parents=[common])
    b.add_argument("--from-year", type=int, default=2023)
    b.add_argument("--revenue-months", type=int, default=36)
    b.add_argument("--dividend-years", type=int, default=10)
    b.add_argument("--price-days", type=int, default=45, help="回補最近幾個日曆天的收盤行情")
    b.add_argument("--steps", nargs="+", choices=BACKFILL_STEPS, default=list(BACKFILL_STEPS))
    sub.add_parser("verify-margins", parents=[common])
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)

    warnings = _WarningCounter()
    logging.getLogger().addHandler(warnings)

    settings = Settings.from_env()
    db = Supabase(settings.supabase_url, settings.service_key)
    try:
        code = _run(args, settings, db)
        if any(r.details.get("degraded") for r in RECORDED):
            # 資料已用備援寫入，但以失敗結束，讓 GitHub Actions 寄出通知
            logging.error("本次使用 FinMind 降級模式：官網與 OpenAPI 都無法取得部分市場的行情")
            return 3
        return code
    finally:
        db.close()
        if summary_path := os.environ.get("GITHUB_STEP_SUMMARY"):
            with open(summary_path, "a", encoding="utf-8") as fh:
                fh.write(render_summary(RECORDED, dry_run=args.dry_run, warnings=warnings.count))


class _WarningCounter(logging.Handler):
    def __init__(self) -> None:
        super().__init__(level=logging.WARNING)
        self.count = 0

    def emit(self, record: logging.LogRecord) -> None:
        self.count += 1


def _run(args: argparse.Namespace, settings: Settings, db: Supabase) -> int:
    with Fetcher() as fetcher:
        ctx = Context(db=db, fetcher=fetcher, settings=settings, dry_run=args.dry_run)
        match args.command:
            case "daily":
                run_daily(ctx)
            case "monthly":
                run_monthly(ctx)
            case "quarterly":
                run_quarterly(ctx, args.years)
            case "dividends":
                run_dividends(ctx, args.years)
            case "snapshot":
                run_snapshot(ctx)
            case "backfill":
                run_backfill(
                    ctx,
                    from_year=args.from_year,
                    revenue_months=args.revenue_months,
                    dividend_years=args.dividend_years,
                    steps=set(args.steps),
                    price_days=args.price_days,
                )
            case "verify-margins":
                return verify_margins(ctx)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
