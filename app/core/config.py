from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    project_name: str = "Synapse Reconciliation Engine"

    # Environment variables mapping constraints
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )

settings = Settings()
