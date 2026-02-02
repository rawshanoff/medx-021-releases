@echo off
start "Backend" cmd /k "call .venv\Scripts\activate && uvicorn backend.main:app --port 8000 --reload"
start "License Server" cmd /k "call .venv\Scripts\activate && uvicorn license_server.main:app --port 8001 --reload"
start "Frontend" cmd /k "cd frontend && npm run dev"
exit /b
