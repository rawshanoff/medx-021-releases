import logging

from backend.core.database import init_db
from backend.core.exceptions import AppException
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
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI(title="MedX API", version="1.0.0")
logger = logging.getLogger("medx")

app.add_middleware(
    CORSMiddleware,
    # Desktop (Electron) and Vite dev can run on varying ports/origins.
    # In MVP we rely on Bearer tokens (not cookies), so credentials aren't required.
    allow_origin_regex=".*",
    allow_credentials=False,
    allow_methods=["*"],
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
    return {"status": "running"}
