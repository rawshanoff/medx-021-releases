FROM python:3.11-slim

WORKDIR /app

# System deps (psycopg2-binary already, but keep build minimal)
RUN python -m pip install --upgrade pip

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend ./backend
COPY license_server ./license_server

ENV PYTHONPATH=/app

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]

