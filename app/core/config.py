from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    project_name: str = "Synapse Reconciliation Engine"
    etims_svd_sender_id: str = "MOCK_SENDER_ID_12345"
    mock_etims: bool = False
    etims_url: str = "https://api.etims-mock.kra.go.ke/v1/invoices"

    redis_url: str = "redis://localhost:6379/0"
    postgres_dsn: str = "postgresql://user:password@localhost:5432/synapse"

    # Environment variables mapping constraints
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )

settings = Settings()
