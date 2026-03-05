import os
import uuid
import asyncio
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

try:
    from services.mongo_service import SentinelDB
except ImportError:
    print(
        "Error: Could not import SentinelDB. Make sure you are running this from the project root."
    )
    exit(1)


async def test_mongo_integration():
    print("--- Starting MongoDB Integration Test ---")

    try:
        db = SentinelDB()
        print("[Pass] SentinelDB initialized")
    except Exception as e:
        print(f"[Fail] SentinelDB initialization failed: {e}")
        return

    # 1. Init Indexes
    try:
        print("Attempting to initialize indexes...")
        await db.init_tables()
        print("[Pass] init_tables executed")
    except Exception as e:
        print(f"[Warn] init_tables failed (expected if no DB connection): {e}")

    # 2. Save Metric
    server_id = f"test-server-{uuid.uuid4().hex[:6]}"
    metric = {
        "server_id": server_id,
        "cpu": 50.5,
        "memory": 60.0,
        "disk": 70.0,
        "network_in": 100.0,
        "network_out": 200.0,
        "timestamp": datetime.utcnow(),
    }
    try:
        await db.save_metric(metric)
        print("[Pass] save_metric executed")
    except Exception as e:
        print(f"[Fail] save_metric failed: {e}")

    # 3. Save Log
    log = {
        "server_id": server_id,
        "method": "GET",
        "path": "/test",
        "status": 200,
        "response_time": 50,
        "ip": "127.0.0.1",
        "user_agent": "test-agent",
        "timestamp": datetime.utcnow(),
    }
    try:
        await db.save_log(log, "web")
        print("[Pass] save_log executed")
    except Exception as e:
        print(f"[Fail] save_log failed: {e}")

    print("--- Test Complete ---")


if __name__ == "__main__":
    asyncio.run(test_mongo_integration())
