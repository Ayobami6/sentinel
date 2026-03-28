import traceback
from typing import Optional, Dict
from datetime import datetime
import uuid

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from services.mongo_service import SentinelDB
from services.auth_service import (
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_token,
    get_current_user,
)

# Load environment variables before importing services that rely on them
load_dotenv()


app = FastAPI(title="Sentinel Ingest API", version="1.0.0")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize DB
db = SentinelDB()


# Ensure tables exist on startup (or handle via separate script/IaC in prod)
@app.on_event("startup")
async def startup_event():
    try:
        await db.init_tables()
        print("MongoDB collections/indexes initialized.")
    except Exception as e:
        print(f"Warning: Could not initialize tables (check MongoDB URI): {e}")


# --- Data Models ---


class MetricIn(BaseModel):
    server_id: str
    cpu: float
    memory: float
    disk: float
    network_in: float
    network_out: float
    timestamp: Optional[datetime] = Field(default_factory=datetime.utcnow)


class WebLogIn(BaseModel):
    server_id: str
    method: str
    path: str
    status: int
    response_time: int
    ip: str
    user_agent: str
    timestamp: Optional[datetime] = Field(default_factory=datetime.utcnow)


class AppLogIn(BaseModel):
    server_id: str
    service: str
    level: str
    message: str
    metadata: Optional[Dict] = None
    timestamp: Optional[datetime] = Field(default_factory=datetime.utcnow)


class ServerIn(BaseModel):
    id: str
    hostname: str
    ip: str
    os: str
    status: str
    agentVersion: str


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# --- Ingestion Endpoints ---


@app.post("/v1/register", status_code=201)
async def register_server(data: ServerIn):
    try:
        server_info = data.model_dump()
        server_info["last_seen"] = datetime.utcnow().isoformat()
        await db.register_server(server_info)
        return {"status": "registered", "id": data.id}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v1/ingest/metrics", status_code=201)
async def ingest_metrics(data: MetricIn, _: dict = Depends(get_current_user)):
    try:
        await db.save_metric(data.model_dump())
        return {"status": "accepted", "id": str(uuid.uuid4())}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v1/ingest/logs/web", status_code=201)
async def ingest_web_logs(data: WebLogIn, _: dict = Depends(get_current_user)):
    try:
        log_entry = data.model_dump()
        await db.save_log(log_entry, "web")
        return {"status": "indexed", "id": str(uuid.uuid4())}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v1/ingest/logs/app", status_code=201)
async def ingest_app_logs(data: AppLogIn, _: dict = Depends(get_current_user)):
    try:
        log_entry = data.model_dump()
        await db.save_log(log_entry, "app")
        return {"status": "indexed", "id": str(uuid.uuid4())}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Query Endpoints ---


@app.get("/v1/query/servers")
async def get_servers(_: dict = Depends(get_current_user)):
    try:
        return await db.get_all_servers()
    except Exception as e:
        print(f"DB Error: {e}")
        return []


@app.get("/v1/query/metrics/{server_id}")
async def get_server_metrics(
    server_id: str, limit: int = 30, _: dict = Depends(get_current_user)
):
    try:
        return await db.get_server_metrics(server_id, limit)
    except Exception as e:
        print(f"DB Error: {e}")
        return []


@app.get("/v1/query/logs/app")
async def get_app_logs(
    server_id: Optional[str] = None,
    limit: int = 50,
    _: dict = Depends(get_current_user),
):
    try:
        return await db.get_logs("app", server_id, limit)
    except Exception as e:
        print(f"DB Error: {e}")
        return []


@app.get("/v1/query/logs/web")
async def get_web_logs(
    server_id: Optional[str] = None,
    limit: int = 50,
    _: dict = Depends(get_current_user),
):
    try:
        return await db.get_logs("web", server_id, limit)
    except Exception as e:
        print(f"DB Error: {e}")
        return []


@app.get("/v1/health")
async def health_check():
    return {"status": "online", "engine": "FastAPI + MongoDB", "uptime": "up"}


# --- Auth Endpoints ---

_REFRESH_COOKIE = "refresh_token"
_COOKIE_MAX_AGE = 604800  # 7 days in seconds


@app.post("/v1/auth/login", response_model=TokenResponse)
async def login(data: LoginRequest, response: Response):
    user = await db.db["users"].find_one({"username": data.username})
    if not user or not verify_password(data.password, user.get("hashed_password", "")):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_data = {"sub": user["username"]}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    response.set_cookie(
        key=_REFRESH_COOKIE,
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=_COOKIE_MAX_AGE,
    )
    return TokenResponse(access_token=access_token)


@app.post("/v1/auth/refresh", response_model=TokenResponse)
async def refresh(request: Request):
    token = request.cookies.get(_REFRESH_COOKIE)
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = verify_token(token)
    except HTTPException:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token({"sub": payload["sub"]})
    return TokenResponse(access_token=access_token)


@app.post("/v1/auth/logout")
async def logout(response: Response):
    response.set_cookie(
        key=_REFRESH_COOKIE,
        value="",
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=0,
    )
    return {"status": "logged out"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
