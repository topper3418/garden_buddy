from pathlib import Path
from pydantic import ValidationError, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
import os


PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    """Application settings loaded from environment variables with GB_ prefix."""
    
    # OpenAI Configuration
    openai_api_key: str | None = None
    openai_api_endpoint: str
    openai_api_model: str
    
    # Development Configuration
    dev_mode: bool = False
    log_level: str = "info"
    
    # Path Configuration
    base_dir: Path = PROJECT_ROOT
    
    @model_validator(mode="after")
    def fallback_to_global_xai_key(self) -> "Settings":
        """Fall back to global XAI_API_KEY if app-specific key is not set."""
        if not self.openai_api_key:
            self.openai_api_key = os.getenv("XAI_API_KEY") or ""
        return self
    
    @property
    def logs_path(self) -> Path:
        """Path to logs directory."""
        return self.base_dir / "data" / "logs"
    
    @property
    def media_path(self) -> Path:
        """Path to media directory."""
        return self.base_dir / "data" / "media"
    
    @property
    def database_path(self) -> Path:
        """Path to database file."""
        return self.base_dir / "data" / "database.db"
    
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        env_prefix="GB_",
        case_sensitive=False,
        extra="ignore"
    )


# Global settings instance.
# Some test environments intentionally omit .env; fall back to empty AI config
# so imports succeed, while AI runtime paths still enforce configuration.
try:
    settings = Settings()  # type: ignore[call-arg]
except ValidationError:
    settings = Settings(  # type: ignore[call-arg]
        openai_api_key="",
        openai_api_endpoint="",
        openai_api_model="",
    )
