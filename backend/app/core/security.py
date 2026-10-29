import hashlib
from datetime import datetime, timedelta, timezone
import jwt
from passlib.context import CryptContext
from app.core.config import settings

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str):
    return pwd.hash(password)


def verify_password(password: str, hashed: str):
    return pwd.verify(password, hashed)


def password_version(password_hash: str):
    """Changes whenever the password does, so older tokens stop working."""
    return hashlib.sha256(password_hash.encode()).hexdigest()[:16]


def create_token(user):
    return jwt.encode(
        {
            "sub": str(user.id),
            "pv": password_version(user.password_hash),
            "exp": datetime.now(timezone.utc) + timedelta(hours=8),
        },
        settings.jwt_secret,
        algorithm="HS256",
    )
