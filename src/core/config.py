from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "executive_os"
    DB_USER: str = "executive_os"
    DB_PASSWORD: str = "changeme"
    
    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    
    # Clairis
    CLAIRIS_EMAIL: str = "comet.ia@vivera.com.br"
    CLAIRIS_PASSWORD: str = "CometIA@2026"
    CLAIRIS_URL: str = "https://app.clairis.com.br"
    
    # Pipedrive
    PIPEDRIVE_API_TOKEN: Optional[str] = None
    PIPEDRIVE_URL: str = "https://api.pipedrive.com/v1"
    
    # Application
    LOG_LEVEL: str = "INFO"
    TZ: str = "America/Sao_Paulo"
    
    # Scheduler
    SYNC_SCHEDULE: str = "0 2 * * *"  # 02:00 daily
    
    # Approval
    AUTO_APPROVE_ENABLED: bool = False
    APPROVAL_TIMEOUT_HOURS: int = 24
    
    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql+psycopg2://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    
    @property
    def REDIS_URL(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True

settings = Settings()
