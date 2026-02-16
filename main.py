
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime
import uuid

app = FastAPI(title="Sentinel Ingest API", version="1.0.0")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# --- In-Memory Storage (MVP) ---
# In a production environment, these would be ClickHouse, PostgreSQL, or TimescaleDB.
metrics_store = []
web_logs_store = []
app_logs_store = []
servers_registry = {
    "srv-01": {"hostname": "prod-api-01", "ip": "10.0.1.45", "os": "Ubuntu 22.04", "status": "healthy"},
    "srv-02": {"hostname": "prod-db-master", "ip": "10.0.1.52", "os": "Debian 11", "status": "warning"},
}

# --- Ingestion Endpoints ---

@app.post("/ingest/metrics", status_code=201)
async def ingest_metrics(data: MetricIn):
    metrics_store.append(data.dict())
    # Keep store size manageable for MVP
    if len(metrics_store) > 1000: metrics_store.pop(0)
    return {"status": "accepted", "id": str(uuid.uuid4())}

@app.post("/ingest/logs/web", status_code=201)
async def ingest_web_logs(data: WebLogIn):
    log_entry = data.dict()
    log_entry["id"] = str(uuid.uuid4())
    web_logs_store.append(log_entry)
    return {"status": "indexed", "id": log_entry["id"]}

@app.post("/ingest/logs/app", status_code=201)
async def ingest_app_logs(data: AppLogIn):
    log_entry = data.dict()
    log_entry["id"] = str(uuid.uuid4())
    app_logs_store.append(log_entry)
    return {"status": "indexed", "id": log_entry["id"]}

# --- Query Endpoints ---

@app.get("/query/servers")
async def get_servers():
    return servers_registry

@app.get("/query/logs/app")
async def get_app_logs(server_id: Optional[str] = None, limit: int = 50):
    logs = app_logs_store
    if server_id:
        logs = [l for l in logs if l["server_id"] == server_id]
    return sorted(logs, key=lambda x: x["timestamp"], reverse=True)[:limit]

@app.get("/health")
async def health_check():
    return {"status": "online", "engine": "FastAPI", "uptime": "up"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
