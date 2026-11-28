import json
from datetime import date

from fastapi.testclient import TestClient

from backend.app.main import ROOT_DIR, app, find_current_week

client = TestClient(app)


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_weeks():
    response = client.get("/api/weeks")
    assert response.status_code == 200
    data = response.json()
    assert "current" in data
    assert len(data["weeks"]) == 18
    assert "days" not in data["weeks"][0]


def test_schedule_week_12():
    response = client.get("/api/schedule", params={"week": 12})
    assert response.status_code == 200
    data = response.json()
    assert data["number"] == 12
    assert len(data["days"]) == 6
    assert data["subgroups_marked"] is True


def test_schedule_week_5_has_no_subgroups():
    response = client.get("/api/schedule", params={"week": 5})
    assert response.status_code == 200
    data = response.json()
    assert data["subgroups_marked"] is False
    lessons = [lesson for day in data["days"] for lesson in day["lessons"]]
    assert lessons
    assert all(lesson["subgroup"] is None for lesson in lessons)


def test_schedule_unknown_week():
    response = client.get("/api/schedule", params={"week": 99})
    assert response.status_code == 404


def test_schedule_without_week_returns_current():
    response = client.get("/api/schedule")
    assert response.status_code == 200
    assert response.json()["number"] == client.get("/api/weeks").json()["current"]


def test_find_current_week():
    weeks = client.get("/api/weeks").json()["weeks"]
    assert find_current_week(weeks, date(2026, 11, 18)) == 12  # среда
    assert find_current_week(weeks, date(2026, 11, 15)) == 12  # воскресенье → понедельник
    assert find_current_week(weeks, date(2026, 8, 1)) == 1  # до семестра
    assert find_current_week(weeks, date(2027, 2, 1)) == 18  # после семестра


def test_format_matches_mock():
    mock_path = ROOT_DIR / "frontend" / "mock" / "week_12.json"
    mock = json.loads(mock_path.read_text(encoding="utf-8"))
    api = client.get("/api/schedule", params={"week": 12}).json()
    assert set(api.keys()) == set(mock.keys())
    assert set(api["days"][0]["lessons"][0].keys()) == set(
        mock["days"][0]["lessons"][0].keys()
    )
