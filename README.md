# 🛡️ Sentinel Observability Suite

Sentinel is a lightweight, in-house observability platform designed for real-time server monitoring, log centralized streaming, and AI-powered performance analysis. It consists of three primary components: a high-performance Go agent, a robust FastAPI ingestion hub, and a sophisticated React dashboard.

## 🏗️ Architecture Overview

The system follows a hub-and-spoke model optimized for minimal resource footprint on monitored nodes.

1.  **Sentinel Agent (Go)**: A system daemon installed via APT. It collects system metrics (CPU, RAM, Disk, Net) and tails logs (Nginx, App logs) to ship them to the central hub.
2.  **Sentinel Hub (FastAPI)**: The central brain. It receives telemetry, indexes logs, and provides a RESTful API for the dashboard.
3.  **Sentinel Dashboard (React)**: A modern, high-fidelity UI for fleet management, log exploration, and AI-driven incident analysis using Gemini.

---

## 🚀 Quick Start

### 1. Central Hub (Backend)
The backend is a FastAPI application that handles data ingestion and querying.
```bash
# Install dependencies
pip install fastapi uvicorn pydantic

# Run the hub
python main.py
```
*Port 8000 is used by default for ingestion and the management API.*

### 2. Monitoring Dashboard (Frontend)
The dashboard provides a real-time view of your infrastructure.
```bash
# Start the development server
npm start
```
*The dashboard will automatically switch to "LIVE" mode when the Hub is detected.*

### 3. Sentinel Agent (Go)
The agent runs on every server you wish to monitor.

#### Build the APT Package:
```bash
cd agent
# Compile the binary
go build -o sentinel-agent main.go
# Build the .deb package
./build.sh
```

#### Install on a Server:
```bash
sudo apt install ./sentinel-agent_1.0.0_amd64.deb
```

---

## ⚙️ Configuration

### Agent Config (`/etc/sentinel/agent.yaml`)
The agent identifies itself and targets the central hub via this YAML file.

```yaml
server_id: "prod-api-01"
backend_url: "http://sentinel-hub.internal:8000"
interval: 15 # Metric collection frequency in seconds
log_files:
  - "/var/log/nginx/access.log" # Recognized as Web Logs via Regex
  - "/var/log/my-app/app.log"    # Recognized as App Logs
```

---

## 📊 Component Breakdown

### Sentinel Agent (Go)
- **Metric Collection**: Leverages `gopsutil` for low-level OS metrics.
- **Log Tailing**: Uses `hpcloud/tail` for non-blocking file monitoring.
- **Web Log Parser**: Implements regex for Nginx/Apache Combined Log Format, extracting status codes and response times.
- **Resilience**: Operates as a `systemd` service with automatic restarts.

### Sentinel Dashboard (React + Vite)
- **Fleet Dashboard**: High-level health status of all nodes.
- **Server Detail**: Deep-dive into specific node metrics with time-series charts.
- **Log Explorer**: Centralized terminal view with server-scoped filtering.
- **Web Analytics**: Real-time RPS (Requests Per Second), Status Code distributions, and Latency heatmaps.
- **Sentinel AI**: Integrated Gemini 3 Flash for intelligent log analysis and root-cause identification.

---

## 🛠️ API Documentation

### Ingestion Endpoints
- `POST /v1/ingest/metrics`: System health telemetry.
- `POST /v1/ingest/logs/web`: Structured HTTP traffic data.
- `POST /v1/ingest/logs/app`: General application event logs.

## Query API (Frontend)

- `GET /v1/query/servers`: List all registered nodes and metadata.
- `GET /v1/query/metrics/{server_id}`: Fetch historical time-series metrics.
- `GET /v1/query/logs/web`: Retrieve and filter HTTP traffic logs.
- `GET /v1/query/logs/app`: Retrieve and filter application event logs.

---

## 🧪 Development Guidelines

### Adding New Metrics
To track a new system metric:
1.  Update the `MetricPayload` struct in `agent/main.go`.
2.  Update the `MetricIn` Pydantic model in `main.py`.
3.  Add the visualization to the `ServerDetail` component in `App.tsx`.

### Custom Log Parsing
The agent uses a regex-based router in `tailLogs`. To support custom log formats:
1.  Modify the `webLogRegex` in `agent/main.go`.
2.  Add specific struct matching for your log format.
3.  Update the backend logic in `main.py` if new fields are required.

---

## 📝 License
Proprietary - Sentinel Internal Monitoring Tools.
