import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

# Корень репозитория: main.py лежит в backend/app/, значит, корень на два уровня выше
ROOT_DIR = Path(__file__).resolve().parents[2]
FRONTEND_DIR = ROOT_DIR / "frontend"
DATA_DIR = ROOT_DIR / "backend" / "data"

# Томск — UTC+7, перехода на летнее время нет
TOMSK = timezone(timedelta(hours=7))

app = FastAPI(title="Хаб 8К64")


def load_json(name: str, default=None):
    """Читает файл из backend/data/. Вызывать внутри обработчиков, а не при старте:
    тогда обновлённый schedule.json подхватывается без перезапуска сервера."""
    path = DATA_DIR / name
    if not path.exists():
        return default
    with open(path, encoding="utf-8") as file:
        return json.load(file)


def load_schedule() -> dict:
    schedule = load_json("schedule.json")
    if schedule is None:
        raise HTTPException(status_code=503, detail="Расписание ещё не загружено")
    return schedule


def find_current_week(weeks: list[dict], today: date) -> int:
    """Номер недели, в которую попадает дата today.

    В воскресенье берём следующий день (понедельник): студенту интересна
    следующая неделя. Раньше первой недели возвращаем первую, позже последней — последнюю.
    """
    if today.weekday() == 6:
        today += timedelta(days=1)
    day = today.isoformat()  # YYYY-MM-DD можно сравнивать как строки
    for week in weeks:
        if week["start"] <= day <= week["end"]:
            return week["number"]
    if day < weeks[0]["start"]:
        return weeks[0]["number"]
    return weeks[-1]["number"]


def current_week_number(weeks: list[dict]) -> int:
    # «Сегодня» по Томску: сервер на хостинге живёт по UTC
    return find_current_week(weeks, datetime.now(TOMSK).date())


def build_rules(subgroups: dict) -> dict:
    """Словарь правил для быстрого поиска: ключ → номер подгруппы."""
    return {
        (rule["parity"], rule["weekday"], rule["pair"], rule["discipline"], rule["type"]):
            rule["subgroup"]
        for rule in subgroups.get("rules", [])
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/weeks")
def get_weeks():
    schedule = load_schedule()
    weeks = [{key: value for key, value in week.items() if key != "days"}
             for week in schedule["weeks"]]
    return {"current": current_week_number(weeks), "weeks": weeks}


@app.get("/api/schedule")
def get_schedule(week: int | None = None):
    schedule = load_schedule()
    if week is None:
        week = current_week_number(schedule["weeks"])
    found = next((item for item in schedule["weeks"] if item["number"] == week), None)
    if found is None:
        raise HTTPException(status_code=404, detail="Неделя не найдена")

    # Справочники читаем при каждом запросе; если файла нет, считаем его пустым
    rules = build_rules(load_json("subgroups.json", default={}))
    disciplines = load_json("disciplines.json", default={})
    teachers = load_json("teachers.json", default={})

    marked = found["period"] == "second"
    days = []
    for day in found["days"]:
        lessons = []
        for lesson in day["lessons"]:
            key = (found["parity"], day["weekday"], lesson["pair"],
                   lesson["discipline"], lesson["type"])
            subgroup = rules.get(key) if marked else None
            lessons.append({
                **lesson,
                "teachers": [
                    {"name": name, "url": teachers.get(name, {}).get("url")}
                    for name in lesson["teachers"]
                ],
                "subgroup": subgroup,
                "moodle_url": disciplines.get(lesson["discipline"], {}).get("moodle"),
            })
        # По контракту: по номеру пары, при совпадении — по подгруппе (sorted устойчивая)
        lessons.sort(key=lambda lesson: (lesson["pair"], lesson["subgroup"] or 0))
        days.append({**day, "lessons": lessons})

    return {
        "number": found["number"],
        "start": found["start"],
        "end": found["end"],
        "parity": found["parity"],
        "period": found["period"],
        "subgroups_marked": marked,
        "rasp_url": schedule["source"].format(week=found["number"]),
        "days": days,
    }


# Статика монтируется ПОСЛЕДНЕЙ: "/" перехватывает все адреса,
# и если поставить её выше, запросы к /api/... до роутов не дойдут
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
