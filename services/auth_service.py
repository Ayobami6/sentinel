import os
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, ExpiredSignatureError, jwt
from passlib.context import CryptContext

load_dotenv()

# --- Configuration ---

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/v1/auth/login")

JWT_SECRET = os.environ.get("JWT_SECRET", "")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is not set")

ALGORITHM = "HS256"

# bcrypt context with cost factor 12
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


# --- Password helpers ---


def hash_password(plain: str) -> str:
    """Hash a plaintext password using bcrypt (cost factor 12)."""
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if *plain* matches the stored *hashed* password."""
    return _pwd_context.verify(plain, hashed)


# --- Token creation ---


def create_access_token(
    data: dict,
    expires_delta: timedelta = timedelta(minutes=15),
) -> str:
    """Create a signed JWT access token."""
    now = datetime.now(tz=timezone.utc)
    payload = {
        **data,
        "iat": now,
        "exp": now + expires_delta,
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


def create_refresh_token(
    data: dict,
    expires_delta: timedelta = timedelta(days=7),
) -> str:
    """Create a signed JWT refresh token."""
    now = datetime.now(tz=timezone.utc)
    payload = {
        **data,
        "iat": now,
        "exp": now + expires_delta,
        "type": "refresh",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


# --- Token validation ---


def verify_token(token: str) -> dict:
    """Decode and validate a JWT.

    Raises HTTP 401 with an appropriate detail message on failure.
    Returns the decoded payload dict on success.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        return payload
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )


# --- FastAPI dependency ---


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """Reusable dependency. Raises HTTP 401 if token is missing or invalid.

    Only accepts tokens with ``type == "access"``; refresh tokens are rejected.
    """
    payload = verify_token(token)
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload
