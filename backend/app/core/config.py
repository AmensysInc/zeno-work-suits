from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = (
        "postgresql+psycopg://trackly:trackly_dev@127.0.0.1:5433/trackly"
    )
    jwt_secret: str
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    # Voice agent transcription (Soniox). SONIX_API_KEY is the old name and still read.
    soniox_api_key: str = ""
    sonix_api_key: str = ""
    # Soniox real-time model; language identification handles mixed-language speech.
    soniox_model: str = "stt-rt-v5"
    # Public URL used in login emails.
    app_url: str = "https://zenoteamsuite.com"
    # Optional: when set, new users and password resets are emailed via SendGrid.
    # Without it the admin copies the temporary password from the screen and shares it.
    sendgrid_api_key: str = ""
    mail_from: str = ""
    mail_from_name: str = "Zeno TeamSuite"
    github_token: str = ""
    # Optional: GitHub users or organizations whose repositories may be linked,
    # e.g. ["AmensysInc"]. Empty allows any repository the token can reach.
    github_allowed_owners: list[str] = []
    openai_api_key: str = ""
    # Model for the requirements/test generator; a larger model drafts more accurately.
    openai_model: str = "gpt-4o-mini"
    # Issue document uploads (images, PDFs, Office files, etc.).
    upload_dir: str = "uploads"
    max_upload_bytes: int = 25 * 1024 * 1024
    # Project video calls (self-hosted LiveKit). Calls are off until the key and
    # secret are set. livekit_url is what browsers connect to (wss://…);
    # livekit_api_url is how the backend reaches the server to see who is in a call.
    livekit_url: str = "wss://zenoteamsuite.com"
    livekit_api_url: str = "http://127.0.0.1:7880"
    livekit_api_key: str = ""
    livekit_api_secret: str = ""
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
