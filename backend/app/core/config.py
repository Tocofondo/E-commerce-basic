"""Configuración central de la aplicación.

Todos los valores se leen de variables de entorno (o de un archivo .env en
desarrollo). Nada de configuración debería estar hardcodeada fuera de acá:
otros módulos importan `settings` desde este archivo en vez de leer
`os.environ` directamente.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- App ---
    APP_NAME: str = "E-commerce Basic API"
    ENVIRONMENT: Literal["local", "test", "staging", "production"] = "local"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # --- CORS ---
    # Orígenes permitidos del frontend (Angular). Separados por coma en el .env.
    CORS_ORIGINS: list[str] = ["http://localhost:4200"]

    # --- Logging ---
    LOG_LEVEL: str = "INFO"

    # --- Postgres (mismos nombres que backend/.env.example, para reusar el .env) ---
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "ecommerce"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432

    @computed_field  # type: ignore[prop-decorator]
    @property
    def DATABASE_URL(self) -> str:
        dsn = PostgresDsn.build(
            scheme="postgresql+psycopg",
            username=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD,
            host=self.POSTGRES_HOST,
            port=self.POSTGRES_PORT,
            path=self.POSTGRES_DB,
        )
        return str(dsn)

    # --- Auth / JWT ---
    SECRET_KEY: str = Field(
        default="change-me-in-.env-this-is-not-secure",
        description="Clave usada para firmar los JWT. Obligatorio cambiarla fuera de local.",
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 día


@lru_cache
def get_settings() -> Settings:
    """Cachea la instancia de Settings (se lee el entorno una sola vez)."""
    return Settings()


settings = get_settings()
