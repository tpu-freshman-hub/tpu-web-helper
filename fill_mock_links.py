"""Одноразовый скрипт: проставляет в моках ссылки из справочников backend/data/.

Делает то же самое, что потом будет делать настоящий API:
берёт предмет и преподавателя из занятия и ищет для них ссылку в справочнике.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
disciplines = json.loads((ROOT / "backend/data/disciplines.json").read_text(encoding="utf-8"))
teachers = json.loads((ROOT / "backend/data/teachers.json").read_text(encoding="utf-8"))

for path in sorted((ROOT / "frontend/mock").glob("week_*.json")):
    week = json.loads(path.read_text(encoding="utf-8"))
    for day in week["days"]:
        for lesson in day["lessons"]:
            # .get(..., {}).get(...) вернёт None, если в справочнике нет такого ключа
            lesson["moodle_url"] = disciplines.get(lesson["discipline"], {}).get("moodle")
            for teacher in lesson["teachers"]:
                teacher["url"] = teachers.get(teacher["name"], {}).get("url")
    path.write_text(json.dumps(week, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("обновлён", path.name)