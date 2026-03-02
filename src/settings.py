# settinigs for the whole app. 
# On every update, the corresponding changes must be applied to 
# scripts/test/test_settings.py
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables with GB_ prefix."""
    
    # OpenAI Configuration
    openai_api_key: str
    openai_api_endpoint: str
    openai_api_model: str
    
    # Development Configuration
    dev_mode: bool = False
    log_level: str = "info"
    
    # Path Configuration
    base_dir: Path = Path(__file__).parent.parent
    
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
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="GB_",
        case_sensitive=False,
        extra="ignore"
    )


# Global settings instance
settings = Settings()  # type: ignore[call-arg]
