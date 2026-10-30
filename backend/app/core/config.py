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
    soniox_model: str = "stt-async-v5"
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
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
