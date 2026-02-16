from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime, timedelta
import uuid
import random

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
metrics_store = []
web_logs_store = []
app_logs_store = []
servers_registry = {
    "srv-01": {
        "id": "srv-01",
        "hostname": "prod-api-01",
        "ip": "10.0.1.45",
        "os": "Ubuntu 22.04",
        "status": "healthy",
        "agentVersion": "v1.2.4",
    },
    "srv-02": {
        "id": "srv-02",
        "hostname": "prod-db-master",
        "ip": "10.0.1.52",
        "os": "Debian 11",
        "status": "warning",
        "agentVersion": "v1.2.4",
    },
}


# Pre-populate data
def pre_populate():
    now = datetime.utcnow()
    paths = [
        "/api/v1/auth",
        "/api/v2/users",
        "/static/logo.png",
        "/api/v1/billing",
        "/health",
    ]

    for sid in servers_registry:
        # Metrics
        for i in range(30):
            metrics_store.append(
                {
                    "server_id": sid,
                    "cpu": (
                        random.uniform(10, 50)
                        if sid == "srv-01"
                        else random.uniform(50, 90)
                    ),
                    "memory": random.uniform(40, 70),
                    "disk": 65,
                    "network_in": random.uniform(100, 500),
                    "network_out": random.uniform(50, 300),
                    "timestamp": now - timedelta(minutes=i),
                }
            )

        # Web Logs
        for i in range(20):
            status = random.choice([200, 200, 201, 404, 500])
            web_logs_store.append(
                {
                    "id": str(uuid.uuid4()),
                    "server_id": sid,
                    "method": random.choice(["GET", "POST"]),
                    "path": random.choice(paths),
                    "status": status,
                    "response_time": random.randint(50, 400),
                    "ip": f"192.168.1.{random.randint(2, 254)}",
                    "user_agent": "Mozilla/5.0...",
                    "timestamp": now - timedelta(seconds=i * 30),
                }
            )

        # App Logs
        levels = ["INFO", "DEBUG", "WARNING", "ERROR"]
        msgs = [
            "Worker thread started",
            "DB Connection pool initialized",
            "Cache miss on key: user_meta",
            "Service heartbeat detected",
        ]
        for i in range(15):
            app_logs_store.append(
                {
                    "id": str(uuid.uuid4()),
                    "server_id": sid,
                    "service": "api-gateway" if sid == "srv-01" else "db-monitor",
                    "level": random.choice(levels),
                    "message": random.choice(msgs),
                    "timestamp": now - timedelta(seconds=i * 45),
                }
            )


pre_populate()

# --- Ingestion Endpoints ---


@app.post("/ingest/metrics", status_code=201)
async def ingest_metrics(data: MetricIn):
    metrics_store.append(data.dict())
    if len(metrics_store) > 5000:
        metrics_store.pop(0)
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
    # Return as list for easier frontend mapping
    return list(servers_registry.values())


@app.get("/query/metrics/{server_id}")
async def get_server_metrics(server_id: str, limit: int = 30):
    logs = [m for m in metrics_store if m["server_id"] == server_id]
    return sorted(logs, key=lambda x: x["timestamp"])[-limit:]


@app.get("/query/logs/app")
async def get_app_logs(server_id: Optional[str] = None, limit: int = 50):
    logs = app_logs_store
    if server_id:
        logs = [l for l in logs if l["server_id"] == server_id]
    return sorted(logs, key=lambda x: x["timestamp"], reverse=True)[:limit]


@app.get("/query/logs/web")
async def get_web_logs(server_id: Optional[str] = None, limit: int = 50):
    logs = web_logs_store
    if server_id:
        logs = [l for l in logs if l["server_id"] == server_id]
    return sorted(logs, key=lambda x: x["timestamp"], reverse=True)[:limit]


@app.get("/health")
async def health_check():
    return {"status": "online", "engine": "FastAPI", "uptime": "up"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
