from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    project_name: str = "Synapse Reconciliation Engine"
    etims_svd_sender_id: str = "MOCK_SENDER_ID_12345"
    mock_etims: bool = False

    redis_url: str = "redis://localhost:6379/0"
    postgres_dsn: str = "postgresql://user:password@localhost:5432/synapse"

    # Explicitly declared KRA eTIMS Integration Parameters
    kra_pin: str
    kra_bhf_id: str
    kra_dvc_srl_no: str
    kra_api_base_url: str

    # Environment variables mapping constraints
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="forbid"  # Enforce structural integrity; reject unauthorized environment variables
    )

settings = Settings()
