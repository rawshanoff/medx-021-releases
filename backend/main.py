# ruff: noqa: E402

import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

# Ensure `backend` package is importable even when running from `backend/` folder:
#   cd backend && python -m uvicorn main:app ...
_repo_root = Path(__file__).resolve().parents[1]
if str(_repo_root) not in sys.path:
    sys.path.insert(0, str(_repo_root))


# IMPORTANT:
# Always import via the `backend.*` package to avoid loading the same models twice
# (e.g., `backend.modules.users.models` and `modules.users.models`) which breaks
# SQLAlchemy metadata with "Table 'users' is already defined".
from datetime import datetime, timezone

from backend.core.config import settings
from backend.core.database import init_db
from backend.core.exceptions import AppException
from backend.core.rate_limit import limiter
from backend.modules.appointments.router import router as appointments_router
from backend.modules.auth import router as auth_router
from backend.modules.doctors.router import router as doctors_router
from backend.modules.files.router import router as files_router
from backend.modules.finance.router import router as finance_router
from backend.modules.licenses.router import router as licenses_router
from backend.modules.patients.router import router as patients_router
from backend.modules.reception.router import router as reception_router
from backend.modules.system.router import router as system_router
from backend.modules.users.router import router as users_router
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded


def _configure_logging() -> None:
    level_name = str(getattr(settings, "LOG_LEVEL", "INFO") or "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    handlers: list[logging.Handler] = [logging.StreamHandler()]

    log_file = getattr(settings, "LOG_FILE", None)
    if log_file:
        path = Path(log_file)
        path.parent.mkdir(parents=True, exist_ok=True)
        handlers.append(
            RotatingFileHandler(
                filename=str(path),
                maxBytes=int(getattr(settings, "LOG_MAX_BYTES", 5_000_000)),
                backupCount=int(getattr(settings, "LOG_BACKUP_COUNT", 3)),
                encoding="utf-8",
            )
        )

    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        handlers=handlers,
    )


_configure_logging()

app = FastAPI(title="MedX API", version="1.0.0")
logger = logging.getLogger("medx")

# Rate Limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS Configuration
# Разрешаем только указанные origins из настроек
cors_origins = [
    origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()
]
# Если origins не указаны, используем безопасные дефолты для разработки
if not cors_origins:
    cors_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3005",
        "http://127.0.0.1:3005",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await init_db()


@app.exception_handler(AppException)
async def app_exception_handler(_request: Request, exc: AppException):
    content: dict = {"detail": exc.detail}
    if exc.code:
        content["code"] = exc.code
    return JSONResponse(status_code=exc.status_code, content=content)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Keep FastAPI default shape
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, exc: Exception):
    # Log full stack trace server-side, but avoid leaking internals to client.
    logger.exception("Unhandled exception", exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})


app.include_router(auth_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(patients_router, prefix="/api/patients", tags=["Patients"])
app.include_router(finance_router, prefix="/api/finance", tags=["Finance"])
app.include_router(doctors_router, prefix="/api/doctors", tags=["Doctors"])
app.include_router(
    appointments_router, prefix="/api/appointments", tags=["Appointments"]
)
app.include_router(system_router, prefix="/api/system", tags=["System"])
app.include_router(reception_router, prefix="/api/reception", tags=["Reception"])
app.include_router(files_router, prefix="/api")
app.include_router(licenses_router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "MedX API is running"}


@app.get("/health")
async def health():
    return {
        "status": "running",
        "version": settings.CURRENT_VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
