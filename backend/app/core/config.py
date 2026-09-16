from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    upload_dir: str = "uploads"
    frontend_origin: str = "http://localhost:5173"
    access_token_expire_minutes: int = 480
    max_upload_size_bytes: int = 5_000_000
    demo_admin_email: str = "admin@demo.local"
    demo_officer_email: str = "officer@demo.local"
    demo_password: str = "ChangeMe123!"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.6-flash"
    gemini_classifier_enabled: bool = False
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
