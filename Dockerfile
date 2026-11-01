FROM python:3.12-slim
WORKDIR /app

# Сначала только зависимости: этот слой пересобирается, только когда меняется requirements.txt
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Потом код (он меняется часто)
COPY backend backend
COPY frontend frontend

EXPOSE 8000
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]