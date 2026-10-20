from datetime import UTC, datetime

from tw_etl.runs import Run, render_summary


def test_render_summary_lists_status_rows_and_errors():
    ok = Run(job="daily", started_at=datetime.now(UTC), rows_written=3961, as_of="2026-10-20", status="success")
    ok.details = {"companies": 1983}
    ok.seconds = 12.3
    bad = Run(job="snapshot", started_at=datetime.now(UTC), status="failed", error="SanityError: 只有 0 檔")
    bad.seconds = 1.0
    md = render_summary([ok, bad], dry_run=True, warnings=2)
    assert "dry-run" in md
    assert "| daily | ✅ | 3,961 | 2026-10-20 | 12 | companies=1983 |" in md
    assert "| snapshot | ❌ | 0 | — | 1 | SanityError: 只有 0 檔 |" in md
    assert "重試／警告次數：2" in md
