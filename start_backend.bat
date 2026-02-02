@echo off
call .venv\Scripts\activate
uvicorn backend.main:app --port 8000 --reload
pause
