from pathlib import Path
from typing import Any, cast

from src.settings import Settings


def _load_settings_from_env_file(env_file: Path) -> Settings:
    settings_cls = cast(Any, Settings)
    return cast(Settings, settings_cls(_env_file=env_file))


def test_settings_loads_from_manual_env_file(tmp_path: Path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text(
        "\n".join(
            [
                "GB_OPENAI_API_KEY=test-key",
                "GB_OPENAI_API_ENDPOINT=https://example.test/v1",
                "GB_OPENAI_API_MODEL=gpt-test-model",
                "GB_DEV_MODE=true",
                "GB_LOG_LEVEL=debug",
            ]
        ),
        encoding="utf-8",
    )

    loaded_settings = _load_settings_from_env_file(env_file)

    assert loaded_settings.openai_api_key == "test-key"
    assert loaded_settings.openai_api_endpoint == "https://example.test/v1"
    assert loaded_settings.openai_api_model == "gpt-test-model"
    assert loaded_settings.dev_mode is True
    assert loaded_settings.log_level == "debug"


def test_settings_paths_are_derived_from_project_root(tmp_path: Path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text(
        "\n".join(
            [
                "GB_OPENAI_API_KEY=test-key",
                "GB_OPENAI_API_ENDPOINT=https://example.test/v1",
                "GB_OPENAI_API_MODEL=gpt-test-model",
            ]
        ),
        encoding="utf-8",
    )

    loaded_settings = _load_settings_from_env_file(env_file)

    assert loaded_settings.logs_path == loaded_settings.base_dir / "data" / "logs"
    assert loaded_settings.media_path == loaded_settings.base_dir / "data" / "media"
    assert loaded_settings.database_path == loaded_settings.base_dir / "data" / "database.db"
