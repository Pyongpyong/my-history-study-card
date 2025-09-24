from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel, Field, computed_field


class Settings(BaseModel):
    openai_api_key: str = Field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))

    extract_model: str = Field(default_factory=lambda: os.getenv("EXTRACT_MODEL", "gpt-5-nano"))
    generate_model: str = Field(default_factory=lambda: os.getenv("GENERATE_MODEL", "gpt-4o-mini"))
    fix_model: str = Field(default_factory=lambda: os.getenv("FIX_MODEL", "gpt-4o-mini"))

    max_out_extract: int = Field(default_factory=lambda: int(os.getenv("MAX_OUT_EXTRACT", "400")))
    max_out_generate: int = Field(default_factory=lambda: int(os.getenv("MAX_OUT_GENERATE", "900")))
    max_out_fix: int = Field(default_factory=lambda: int(os.getenv("MAX_OUT_FIX", "400")))

    temp_extract: float = Field(default_factory=lambda: float(os.getenv("TEMP_EXTRACT", "0.2")))
    temp_generate: float = Field(default_factory=lambda: float(os.getenv("TEMP_GENERATE", "0.4")))
    temp_fix: float = Field(default_factory=lambda: float(os.getenv("TEMP_FIX", "0.2")))

    gen_batch_size: int = Field(default_factory=lambda: int(os.getenv("GEN_BATCH_SIZE", "3")))

    cache_ttl: int = Field(default_factory=lambda: int(os.getenv("CACHE_TTL", os.getenv("AI_CACHE_TTL", "86400"))))
    cache_dir: Path = Field(default_factory=lambda: Path(os.getenv("AI_CACHE_DIR", "app/cache")))

    request_timeout_sec: float = Field(default_factory=lambda: float(os.getenv("REQUEST_TIMEOUT_SEC", os.getenv("OPENAI_TIMEOUT", "60"))))

    rate_limit_window_seconds: int = Field(default_factory=lambda: int(os.getenv("AI_RATE_LIMIT_WINDOW", "30")))
    rate_limit_quota: int = Field(default_factory=lambda: int(os.getenv("AI_RATE_LIMIT_QUOTA", "3")))

    @computed_field  # type: ignore[misc]
    @property
    def cache_dir_path(self) -> Path:
        directory = Path(self.cache_dir).resolve()
        directory.mkdir(parents=True, exist_ok=True)
        return directory

    def json_schema_format(self, name: str, schema: dict) -> dict:
        return {
            "type": "json_schema",
            "json_schema": {
                "name": name,
                "schema": schema,
                "strict": True,
            },
        }


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
