import traceback
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict
from datetime import datetime
import uuid
from fastapi.middleware.cors import CORSMiddleware
from services.dynamo_service import SentinelDB
import traceback

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
        db.init_tables()
        print("DynamoDB tables initialized/verified.")
    except Exception as e:
        print(f"Warning: Could not initialize tables (check AWS creds): {e}")


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


# --- Ingestion Endpoints ---


@app.post("/register", status_code=201)
async def register_server(data: ServerIn):
    try:
        server_info = data.model_dump()
        server_info["last_seen"] = datetime.utcnow().isoformat()
        db.register_server(server_info)
        return {"status": "registered", "id": data.id}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ingest/metrics", status_code=201)
async def ingest_metrics(data: MetricIn):
    try:
        db.save_metric(data.model_dump())
        return {"status": "accepted", "id": str(uuid.uuid4())}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ingest/logs/web", status_code=201)
async def ingest_web_logs(data: WebLogIn):
    try:
        log_entry = data.model_dump()
        db.save_log(log_entry, "web")
        return {"status": "indexed", "id": str(uuid.uuid4())}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ingest/logs/app", status_code=201)
async def ingest_app_logs(data: AppLogIn):
    try:
        log_entry = data.model_dump()
        db.save_log(log_entry, "app")
        return {"status": "indexed", "id": str(uuid.uuid4())}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Query Endpoints ---


@app.get("/query/servers")
async def get_servers():
    try:
        return db.get_all_servers()
    except Exception as e:
        print(f"DB Error: {e}")
        return []


@app.get("/query/metrics/{server_id}")
async def get_server_metrics(server_id: str, limit: int = 30):
    try:
        return db.get_server_metrics(server_id, limit)
    except Exception as e:
        print(f"DB Error: {e}")
        return []


@app.get("/query/logs/app")
async def get_app_logs(server_id: Optional[str] = None, limit: int = 50):
    try:
        return db.get_logs("app", server_id, limit)
    except Exception as e:
        print(f"DB Error: {e}")
        return []


@app.get("/query/logs/web")
async def get_web_logs(server_id: Optional[str] = None, limit: int = 50):
    try:
        return db.get_logs("web", server_id, limit)
    except Exception as e:
        print(f"DB Error: {e}")
        return []


@app.get("/health")
async def health_check():
    return {"status": "online", "engine": "FastAPI + DynamoDB", "uptime": "up"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
