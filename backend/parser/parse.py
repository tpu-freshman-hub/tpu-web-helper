"""Парсер страницы недели ro-rasp.tpu.ru: HTML + ключ -> список занятий.

Запуск из корня репозитория:
    python -m backend.parser.parse 12
"""
import sys
from datetime import datetime
from pathlib import Path

from bs4 import BeautifulSoup, Tag

from backend.parser.rasp_decrypt import decrypt

RAW_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"

LESSON_TYPES = {
    "Лекция": "lecture",
    "Практика": "practice",
    "Лабораторная работа": "lab",
}
WEEKDAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]


def _split_blocks(cell: Tag) -> list[list[Tag]]:
    """Делит содержимое ячейки на блоки по <hr>."""
    blocks: list[list[Tag]] = [[]]
    for child in cell.children:
        if not isinstance(child, Tag):
            continue
        if child.name == "hr":
            blocks.append([])
        else:
            blocks[-1].append(child)
    return [block for block in blocks if block]


def _select(block: list[Tag], selector: str) -> list[Tag]:
    """Ищет по селектору внутри всех тегов блока (в порядке документа)."""
    found: list[Tag] = []
    for tag in block:
        found.extend(tag.select(selector))
    return found


def _extract_teachers(block: list[Tag]) -> list[str]:
    return [a.get_text(strip=True) for a in _select(block, 'a[href^="/user_"]')]


def _extract_rooms(block: list[Tag]) -> list[str]:
    """Собирает «к. КЦ, ауд. 418» из пар ссылок корпус + аудитория."""
    rooms: list[str] = []
    building = None
    links = _select(block, 'a[href^="/sooruzhenie_"], a[href^="/pomeschenie_"]')
    for link in links:
        text = link.get_text(strip=True)
        if link["href"].startswith("/sooruzhenie_"):
            if building is not None:  # предыдущий корпус остался без аудитории
                rooms.append(f"к. {building}")
            building = text
        else:
            rooms.append(f"к. {building}, ауд. {text}" if building else f"ауд. {text}")
            building = None
    if building is not None:
        rooms.append(f"к. {building}")
    return rooms


def _parse_cell(cell: Tag, key: str) -> list[dict]:
    """Возвращает занятия одной ячейки (без даты/времени, их добавит вызывающий)."""
    lessons: list[dict] = []
    for block in _split_blocks(cell):
        spans = _select(block, "span.encrypt")
        if spans:
            span = spans[0]
            title_attr = span.get("data-title")
            discipline = decrypt(title_attr, key) if title_attr else ""
            bold = _select(block, "b[title]")
            lesson_type = "other"
            if bold:
                lesson_type = LESSON_TYPES.get(bold[0]["title"], "other")
            lessons.append(
                {
                    "discipline": discipline,
                    "type": lesson_type,
                    "teachers": _extract_teachers(block),
                    "rooms": _extract_rooms(block),
                }
            )
        elif lessons:
            # блок-продолжение: дописываем к последнему занятию
            lessons[-1]["teachers"].extend(_extract_teachers(block))
            lessons[-1]["rooms"].extend(_extract_rooms(block))
    return lessons


def parse_week(html: str, key: str) -> list[dict]:
    """Разбирает страницу одной недели и возвращает список занятий."""
    soup = BeautifulSoup(html, "html.parser")
    table = soup.select_one("table.timetable")
    if table is None:
        return []

    # Даты столбцов: «16.11.26 понедельник» -> 2026-11-16 (первый th — «Время»)
    dates: list[str] = []
    for th in table.select("thead th")[1:]:
        raw_date = th.get_text(" ", strip=True).split()[0]
        dates.append(datetime.strptime(raw_date, "%d.%m.%y").date().isoformat())

    lessons: list[dict] = []
    for pair, row in enumerate(table.select("tbody tr"), start=1):
        time_td = row.find("td")
        time_title = time_td.get("title", "") if time_td is not None else ""
        parts = [part.strip() for part in time_title.split("-")]
        if len(parts) != 2:
            continue
        start, end = parts

        for weekday, cell in enumerate(row.select("td.cell"), start=1):
            if weekday > len(dates):
                break
            for item in _parse_cell(cell, key):
                lessons.append(
                    {
                        "date": dates[weekday - 1],
                        "weekday": weekday,
                        "pair": pair,
                        "start": start,
                        "end": end,
                        **item,
                    }
                )

    lessons.sort(key=lambda lesson: (lesson["weekday"], lesson["pair"]))
    return lessons


def _format_lesson(lesson: dict) -> str:
    year, month, day = lesson["date"].split("-")
    weekday = WEEKDAY_NAMES[lesson["weekday"] - 1]
    teachers = ", ".join(lesson["teachers"]) or "—"
    rooms = "; ".join(lesson["rooms"]) or "—"
    return (
        f"{weekday} {day}.{month} | {lesson['pair']} пара "
        f"{lesson['start']}–{lesson['end']} | "
        f"{lesson['discipline']} [{lesson['type']}] | {teachers} | {rooms}"
    )


if __name__ == "__main__":
    week = int(sys.argv[1]) if len(sys.argv) > 1 else 12
    html = (RAW_DIR / f"week_{week:02d}.html").read_text(encoding="utf-8")
    key = (RAW_DIR / f"week_{week:02d}.key").read_text(encoding="utf-8").strip()
    result = parse_week(html, key)
    for item in result:
        print(_format_lesson(item))
    print(f"Всего занятий: {len(result)}")
