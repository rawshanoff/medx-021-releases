@echo off
call .venv\Scripts\activate
uvicorn license_server.main:app --port 8001 --reload
pause
