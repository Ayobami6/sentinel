import os
import asyncio
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

from services.mongo_service import SentinelDB


async def verify_split():
    print("Initializing SentinelDB...")
    db = SentinelDB()
    await db.init_tables()
    print("Indexes initialized.")

    # Create dummy logs
    server_id = "test-split-server"
    timestamp = datetime.utcnow().isoformat()

    web_log = {
        "server_id": server_id,
        "method": "GET",
        "path": "/test-mongo-split",
        "status": 200,
        "response_time": 10,
        "ip": "1.2.3.4",
        "user_agent": "test-agent",
        "timestamp": timestamp,
    }

    app_log = {
        "server_id": server_id,
        "service": "test-service",
        "level": "INFO",
        "message": "Test mongo split log",
        "timestamp": timestamp,
    }

    print("Saving logs...")
    await db.save_log(web_log, "web")
    await db.save_log(app_log, "app")

    print("Verifying Web Logs...")
    web_results = await db.get_logs("web", limit=10)
    found_web = any(l.get("path") == "/test-mongo-split" for l in web_results)
    if found_web:
        print("[PASS] Found web log in SentinelWebLogs (via get_logs)")
    else:
        print("[FAIL] Did not find web log")

    print("Verifying App Logs...")
    app_results = await db.get_logs("app", limit=10)
    found_app = any(l.get("message") == "Test mongo split log" for l in app_results)
    if found_app:
        print("[PASS] Found app log in SentinelAppLogs (via get_logs)")
    else:
        print("[FAIL] Did not find app log")

    # Direct Collection Check
    print("Checking MongoDB collections directly...")

    web_count = await db.web_logs_col.count_documents({})
    if web_count > 0:
        print(f"[PASS] web_logs collection has {web_count} items.")
    else:
        print("[WARN] web_logs collection is empty.")

    app_count = await db.app_logs_col.count_documents({})
    if app_count > 0:
        print(f"[PASS] app_logs collection has {app_count} items.")
    else:
        print("[WARN] app_logs collection is empty.")


if __name__ == "__main__":
    asyncio.run(verify_split())
