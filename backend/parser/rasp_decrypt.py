"""
Готовый хелпер для бэкендера: скачать страницу недели с ro-rasp.tpu.ru
и расшифровать названия предметов.

Почему он нужен: в HTML названия предметов лежат не текстом, а так:
    <span class="encrypt" data-encrypt="0ZLQhNCV..." data-title="0ZLQhNCV..."></span>
В браузере их расшифровывает JavaScript сайта. Как он это делает
(видно в DevTools -> вкладка Network):
  1. В <head> страницы есть <meta name="encrypt" content="...">.
  2. Скрипт отправляет это значение POST-запросом на /data/encrypt/decrypt.html
     и получает в ответ ключ: {"content": "<ключ>", "message": "OK"}.
  3. Каждую строку data-encrypt / data-title декодирует из base64 и
     делает XOR каждого символа с символом ключа (ключ повторяется по кругу).
Ключ привязан к сессии (cookie), поэтому страницу и ключ надо брать
одним requests.Session().

Использование:
    python rasp_decrypt.py 12      # скачать неделю 12 и показать предметы
"""
import base64
import re
import sys

import requests

BASE_URL = "https://ro-rasp.tpu.ru"
GROUP_ID = 45259  # 8К64
YEAR = 2026  # учебный год (в URL — год его начала)
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}


def fetch_week(session: requests.Session, week: int) -> tuple[str, str]:
    """Скачивает HTML недели и возвращает (html, ключ_для_расшифровки)."""
    url = f"{BASE_URL}/gruppa_{GROUP_ID}/{YEAR}/{week}/view.html"
    response = session.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()
    html = response.text

    meta = re.search(r'<meta name="encrypt" content="([^"]+)"', html).group(1)
    csrf = re.search(r'<meta name="csrf-token" content="([^"]+)"', html).group(1)

    key_response = session.post(
        f"{BASE_URL}/data/encrypt/decrypt.html",
        data={"content": meta, "token": "token", "_csrf": csrf},
        headers={**HEADERS, "X-Requested-With": "XMLHttpRequest", "X-CSRF-Token": csrf},
        timeout=30,
    )
    key_response.raise_for_status()
    key = key_response.json()["content"]
    return html, key


def decrypt(encrypted: str, key: str) -> str:
    """Расшифровывает значение атрибута data-encrypt / data-title."""
    text = base64.b64decode(encrypted).decode("utf-8")
    return "".join(chr(ord(ch) ^ ord(key[i % len(key)])) for i, ch in enumerate(text))


if __name__ == "__main__":
    week = int(sys.argv[1]) if len(sys.argv) > 1 else 12
    with requests.Session() as session:
        html, key = fetch_week(session, week)
    titles = re.findall(r'data-title="([^"]+)"', html)
    for name in sorted({decrypt(t, key) for t in titles}):
        print(name)
