from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Union
from pydantic import field_validator


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Yelp API
    yelp_api_key: str
    yelp_api_base_url: str = "https://api.yelp.com"

    # Google Gemini API
    gemini_api_key: str

    # Serper API (for CrewAI web scraping)
    serper_api_key: str = ""

    # Google Calendar OAuth2
    google_calendar_client_id: str
    google_calendar_client_secret: str
    google_oauth_redirect_uri: str = "http://localhost:3000/auth/google/callback"

    # Server
    host: str = "127.0.0.1"
    port: int = 8000

    # CORS
    cors_origins: Union[List[str], str] = "http://localhost:3000,http://127.0.0.1:3000"

    @field_validator('cors_origins', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(',')]
        return v


    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra='ignore'
    )


settings = Settings()
