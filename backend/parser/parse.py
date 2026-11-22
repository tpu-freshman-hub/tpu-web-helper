"""
Разбор страницы недели ro-rasp.tpu.ru: HTML + ключ → список занятий.

Запуск из корня репозитория:
    python -m backend.parser.parse 12    # напечатать занятия недели 12

Страницы и ключи берутся из backend/data/raw/ (их скачивает
python -m backend.parser.fetch). Как устроена разметка — в PARSER_NOTES.md.
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

WEEKDAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]


def _split_blocks(cell: Tag) -> list[list[Tag]]:
    """Делит содержимое ячейки на блоки занятий по тегу <hr>."""
    blocks: list[list[Tag]] = [[]]
    for child in cell.children:
        if not isinstance(child, Tag):  # переводы строк и пробелы между тегами
            continue
        if child.name == "hr":
            blocks.append([])
        else:
            blocks[-1].append(child)
    return [block for block in blocks if block]


def _select(block: list[Tag], selector: str) -> list[Tag]:
    """select() по всем тегам блока, с сохранением порядка на странице."""
    found: list[Tag] = []
    for tag in block:
        if tag.name and tag.css.match(selector):
            found.append(tag)
        found.extend(tag.select(selector))
    return found


def _teachers(block: list[Tag]) -> list[str]:
    return [a.get_text(strip=True) for a in _select(block, 'a[href^="/user_"]')]


def _rooms(block: list[Tag]) -> list[str]:
    """Пары ссылок «корпус → аудитория» превращаются в «к. КЦ, ауд. 418»."""
    rooms: list[str] = []
    building = None
    for a in _select(block, 'a[href^="/sooruzhenie_"], a[href^="/pomeschenie_"]'):
        text = a.get_text(strip=True)
        if a["href"].startswith("/sooruzhenie_"):
            if building is not None:  # корпус без аудитории
                rooms.append(f"к. {building}")
            building = text
        else:
            rooms.append(f"к. {building}, ауд. {text}" if building else f"ауд. {text}")
            building = None
    if building is not None:
        rooms.append(f"к. {building}")
    return rooms


def _add_unique(target: list[str], items: list[str]) -> None:
    """Дописывает элементы, пропуская те, что уже есть (лекция с двумя
    преподавателями в одной аудитории не должна дать две одинаковые строки)."""
    for item in items:
        if item not in target:
            target.append(item)


def _day_dates(table: Tag) -> list[str]:
    """«16.11.26 понедельник» из заголовков столбцов → ['2026-11-16', …]."""
    dates = []
    for th in table.select("thead th")[1:]:
        day = th.get_text(" ", strip=True).split()[0]
        dates.append(datetime.strptime(day, "%d.%m.%y").date().isoformat())
    return dates


def parse_week(html: str, key: str) -> list[dict]:
    """Возвращает занятия недели в порядке «день → пара → как на сайте»."""
    soup = BeautifulSoup(html, "html.parser")
    table = soup.select_one("table.timetable")
    if table is None:
        raise ValueError("На странице нет table.timetable — разметка ro-rasp изменилась?")

    dates = _day_dates(table)
    by_day: list[list[dict]] = [[] for _ in dates]
    # Выходной или праздник — одна ячейка td.free-day с rowspan="7" на весь столбец,
    # и в следующих строках этого столбца ячеек нет. Помним, сколько строк
    # каждый столбец ещё занят, чтобы не сдвинуть остальные дни влево.
    busy_rows = [0] * len(dates)

    for pair, row in enumerate(table.select("tbody > tr"), start=1):
        time_cell, *day_cells = row.find_all("td", recursive=False)
        start, end = (part.strip() for part in time_cell["title"].split("-"))

        cells: list[Tag | None] = []
        for index in range(len(dates)):
            if busy_rows[index] > 0:
                busy_rows[index] -= 1
                cells.append(None)
                continue
            if not day_cells:
                raise ValueError(f"Пара {pair}: в строке не хватает ячеек")
            cell = day_cells.pop(0)
            busy_rows[index] = int(cell.get("rowspan", 1)) - 1
            cells.append(cell if "cell" in cell.get("class", []) else None)
        if day_cells:
            raise ValueError(f"Пара {pair}: в строке лишние ячейки")

        for index, cell in enumerate(cells):
            if cell is None:
                continue
            last = None
            for block in _split_blocks(cell):
                teachers = _teachers(block)
                rooms = _rooms(block)
                names = _select(block, ".encrypt")

                if not names:  # блок-продолжение: ещё одна группа того же занятия
                    if last is None:
                        raise ValueError(f"{dates[index]}, пара {pair}: продолжение без занятия")
                    _add_unique(last["teachers"], teachers)
                    _add_unique(last["rooms"], rooms)
                    continue

                type_tag = _select(block, "b[title]")
                type_title = type_tag[0]["title"] if type_tag else ""
                # У предмета полное название в data-title, сокращённое в data-encrypt.
                # У мероприятия (собрание, тестирование, гостевая лекция) — ссылка
                # a.encrypt с одним data-encrypt, и там полное описание.
                encrypted = names[0].get("data-title") or names[0]["data-encrypt"]
                last = {
                    "date": dates[index],
                    "weekday": index + 1,
                    "pair": pair,
                    "start": start,
                    "end": end,
                    "discipline": " ".join(decrypt(encrypted, key).split()),
                    "type": LESSON_TYPES.get(type_title, "other"),
                    "teachers": [],
                    "rooms": [],
                }
                _add_unique(last["teachers"], teachers)
                _add_unique(last["rooms"], rooms)
                by_day[index].append(last)

    return [lesson for day in by_day for lesson in day]


def read_raw_week(week: int) -> tuple[str, str]:
    """Читает week_NN.html и week_NN.key, скачанные fetch.py."""
    html_path = RAW_DIR / f"week_{week:02d}.html"
    key_path = RAW_DIR / f"week_{week:02d}.key"
    for path in (html_path, key_path):
        if not path.exists():
            raise FileNotFoundError(
                f"Нет файла {path.name} — сначала запустите python -m backend.parser.fetch"
            )
    return html_path.read_text(encoding="utf-8"), key_path.read_text(encoding="utf-8").strip()


def format_lesson(lesson: dict) -> str:
    date = datetime.fromisoformat(lesson["date"]).strftime("%d.%m")
    return " | ".join([
        f"{WEEKDAY_SHORT[lesson['weekday'] - 1]} {date}",
        f"{lesson['pair']} пара {lesson['start']}–{lesson['end']}",
        f"{lesson['discipline']} [{lesson['type']}]",
        ", ".join(lesson["teachers"]) or "—",
        "; ".join(lesson["rooms"]) or "—",
    ])


def main() -> None:
    week = int(sys.argv[1]) if len(sys.argv) > 1 else 12
    try:
        html, key = read_raw_week(week)
    except FileNotFoundError as error:
        sys.exit(str(error))
    lessons = parse_week(html, key)
    for lesson in lessons:
        print(format_lesson(lesson))
    print(f"Неделя {week}: {len(lessons)} занятий")


if __name__ == "__main__":
    main()
