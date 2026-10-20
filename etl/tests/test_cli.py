from tw_etl.__main__ import build_parser


def test_options_come_after_subcommand():
    args = build_parser().parse_args(["backfill", "--dry-run", "--from-year", "2024", "--steps", "quarterly"])
    assert args.command == "backfill"
    assert args.dry_run is True
    assert args.from_year == 2024
    assert args.steps == ["quarterly"]


def test_defaults():
    args = build_parser().parse_args(["daily"])
    assert args.dry_run is False
    args = build_parser().parse_args(["quarterly", "--years", "2025", "2026"])
    assert args.years == [2025, 2026]
