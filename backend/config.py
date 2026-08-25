from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
    ]
    data_dir: str = "mock_data"

    # PRD R8: the connection string is supplied by the environment and never
    # committed, in any environment. `.env` is gitignored; there is deliberately
    # no default here, so a misconfigured deploy fails loudly at startup instead
    # of silently falling back to some other database.
    database_url: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
