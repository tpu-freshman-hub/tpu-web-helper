from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

# Корень репозитория: main.py лежит в backend/app/, значит, корень на два уровня выше
ROOT_DIR = Path(__file__).resolve().parents[2]
FRONTEND_DIR = ROOT_DIR / "frontend"

app = FastAPI(title="Хаб 8К64")


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Статика монтируется ПОСЛЕДНЕЙ: "/" перехватывает все адреса,
# и если поставить её выше, запросы к /api/... до роутов не дойдут
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")