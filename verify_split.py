import os
from dotenv import load_dotenv
import boto3
from datetime import datetime

load_dotenv()

# Initialize DynamoDB resource
dynamodb = boto3.resource(
    "dynamodb",
    region_name=os.getenv("AWS_REGION", "us-east-1"),
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
)

from services.dynamo_service import SentinelDB


def verify_split():
    print("Initializing SentinelDB...")
    db = SentinelDB()
    db.init_tables()
    print("Tables initialized.")

    # Create dummy logs
    server_id = "test-split-server"
    timestamp = datetime.utcnow().isoformat()

    web_log = {
        "server_id": server_id,
        "method": "GET",
        "path": "/test-split",
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
        "message": "Test split log",
        "timestamp": timestamp,
    }

    print("Saving logs...")
    db.save_log(web_log, "web")
    db.save_log(app_log, "app")

    print("Verifying Web Logs...")
    web_results = db.get_logs("web", limit=10)
    found_web = any(l.get("path") == "/test-split" for l in web_results)
    if found_web:
        print("[PASS] Found web log in SentinelWebLogs (via get_logs)")
    else:
        print("[FAIL] Did not find web log")

    print("Verifying App Logs...")
    app_results = db.get_logs("app", limit=10)
    found_app = any(l.get("message") == "Test split log" for l in app_results)
    if found_app:
        print("[PASS] Found app log in SentinelAppLogs (via get_logs)")
    else:
        print("[FAIL] Did not find app log")

    # Direct Table Check
    print("Checking DynamoDB tables directly...")
    web_table = dynamodb.Table("SentinelWebLogs")
    app_table = dynamodb.Table("SentinelAppLogs")

    scan_web = web_table.scan(Limit=10)
    if scan_web["Count"] > 0:
        print(f"[PASS] SentinelWebLogs table has {scan_web['Count']} items.")
    else:
        print("[WARN] SentinelWebLogs table is empty (might be eventual consistency).")

    scan_app = app_table.scan(Limit=10)
    if scan_app["Count"] > 0:
        print(f"[PASS] SentinelAppLogs table has {scan_app['Count']} items.")
    else:
        print("[WARN] SentinelAppLogs table is empty.")


if __name__ == "__main__":
    verify_split()
