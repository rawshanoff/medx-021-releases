@echo off
chcp 65001
set PYTHONIOENCODING=utf-8
set PGCLIENTENCODING=utf-8
call .venv\Scripts\activate
alembic -c backend/alembic.ini upgrade head
pause
