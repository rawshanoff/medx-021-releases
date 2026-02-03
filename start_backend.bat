@echo off
call .venv\Scripts\activate
cd /d %~dp0
uvicorn backend.main:app --port 8000 --reload
pause
