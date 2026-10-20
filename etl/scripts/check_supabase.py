"""確認 .env.local 的 Supabase 設定可以連線。不會印出 key 的內容。

python etl/scripts/check_supabase.py
"""

from __future__ import annotations

import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def load_env_file(path: Path) -> dict[str, str]:
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


def describe_key(value: str) -> str:
    if value.startswith("sb_publishable_"):
        return "新版 publishable key"
    if value.startswith("sb_secret_"):
        return "新版 secret key"
    if value.startswith("eyJ"):
        return "舊版 JWT key"
    return "無法辨識的格式"


def get(url: str, key: str) -> tuple[int, str]:
    req = urllib.request.Request(url, headers={"apikey": key, "Authorization": f"Bearer {key}"})
    if key.startswith("sb_"):
        req.remove_header("Authorization")  # 新版 key 不是 JWT，只放在 apikey header
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, ""
    except urllib.error.HTTPError as e:
        return e.code, e.read(200).decode("utf-8", errors="replace")


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    env = {**load_env_file(ROOT / ".env.local"), **os.environ}
    url = env.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
    anon = env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
    secret = env.get("SUPABASE_SERVICE_ROLE_KEY", "")

    ok = True
    for name, value in [
        ("NEXT_PUBLIC_SUPABASE_URL", url),
        ("NEXT_PUBLIC_SUPABASE_ANON_KEY", anon),
        ("SUPABASE_SERVICE_ROLE_KEY", secret),
    ]:
        if not value:
            print(f"❌ {name} 沒有設定")
            ok = False
    if not ok:
        return 1

    print(f"URL：{url}")
    print(f"公開 key：{describe_key(anon)}（{len(anon)} 字元）")
    print(f"機密 key：{describe_key(secret)}（{len(secret)} 字元）")
    if anon == secret:
        print("❌ 公開 key 與機密 key 相同，請確認沒有填錯")
        return 1
    if anon.startswith("sb_secret_"):
        print("❌ 公開 key 欄位填成了 secret key，這會讓機密 key 暴露在瀏覽器")
        return 1

    status, body = get(f"{url}/auth/v1/health", anon)
    print(f"{'✅' if status == 200 else '❌'} 公開 key 連線 auth：HTTP {status} {body[:120]}")
    ok &= status == 200

    status, body = get(f"{url}/rest/v1/", secret)
    print(f"{'✅' if status == 200 else '❌'} 機密 key 連線 REST：HTTP {status} {body[:120]}")
    ok &= status == 200

    revalidate = env.get("REVALIDATE_SECRET", "")
    mark = "✅" if len(revalidate) >= 32 else "⚠️ "
    print(f"{mark} REVALIDATE_SECRET：{len(revalidate)} 字元（需要 ≥ 32，P5 才會用到）")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
