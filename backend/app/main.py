from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import router
from app.api_advisories import router as advisories_router
from app.api_advisories import complaints_advisories_router
from app.core.config import get_settings
from app.database import database_is_available, engine

settings = get_settings()
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(_: FastAPI):
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    yield
    await engine.dispose()


app = FastAPI(title="Civic Issue Reporting API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(advisories_router)
app.include_router(complaints_advisories_router)
app.include_router(router)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.get("/api/health", tags=["system"])
async def health_check(response: Response) -> dict[str, str]:
    """Report whether the API and its database connection are ready."""
    if not await database_is_available():
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "unavailable", "database": "unavailable"}
    return {"status": "ok", "database": "connected"}
