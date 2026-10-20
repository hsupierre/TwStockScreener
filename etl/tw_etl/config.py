"""設定：優先讀環境變數（GitHub Actions secrets），本機開發時補讀 repo 根目錄的 .env.local。"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def _load_env_file(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not path.exists():
        return env
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


class ConfigError(RuntimeError):
    pass


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    service_key: str
    site_url: str | None = None
    revalidate_secret: str | None = None

    @classmethod
    def from_env(cls, env_file: Path | None = REPO_ROOT / ".env.local") -> Settings:
        file_env = _load_env_file(env_file) if env_file else {}
        env = {**file_env, **{k: v for k, v in os.environ.items() if v}}
        url = env.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
        key = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
        missing = [n for n, v in (("NEXT_PUBLIC_SUPABASE_URL", url), ("SUPABASE_SERVICE_ROLE_KEY", key)) if not v]
        if missing:
            raise ConfigError(f"缺少環境變數：{', '.join(missing)}（請設定 .env.local 或 GitHub secrets）")
        return cls(
            supabase_url=url,
            service_key=key,
            site_url=(env.get("NEXT_PUBLIC_SITE_URL") or "").rstrip("/") or None,
            revalidate_secret=env.get("REVALIDATE_SECRET") or None,
        )
