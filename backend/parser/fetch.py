import time
from pathlib import Path

import requests

from backend.parser.rasp_decrypt import fetch_week

RAW_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"
WEEKS = range(1, 19)


def main() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    ok = 0

    for week in WEEKS:
        try:
            html, key = fetch_week(session, week)
            (RAW_DIR / f"week_{week:02d}.html").write_text(html, encoding="utf-8")
            (RAW_DIR / f"week_{week:02d}.key").write_text(key, encoding="utf-8")
            size_kb = len(html.encode("utf-8")) / 1024
            print(f"Неделя {week}: OK, {size_kb:.0f} КБ")
            ok += 1
        except (requests.RequestException, OSError) as error:
            print(f"Неделя {week}: ОШИБКА — {error}")

    print(f"Скачано {ok} из {len(WEEKS)} недель.")


if __name__ == "__main__":
    main()
