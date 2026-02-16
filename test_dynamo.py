import boto3
import os
import uuid
from datetime import datetime
import time

# Mock AWS credentials if not present, to avoid boto3 errors if user hasn't set them yet
if not os.getenv("AWS_ACCESS_KEY_ID"):
    os.environ["AWS_ACCESS_KEY_ID"] = "testing"
    os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
    os.environ["AWS_SECURITY_TOKEN"] = "testing"
    os.environ["AWS_SESSION_TOKEN"] = "testing"
    os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

try:
    from services.dynamo_service import SentinelDB
except ImportError:
    print(
        "Error: Could not import SentinelDB. Make sure you are running this from the project root."
    )
    exit(1)


def test_dynamo_integration():
    print("--- Starting DynamoDB Integration Test ---")

    # Check if a local DynamoDB or AWS is accessible
    # This test might fail if no credentials or network, but it validates the code path.
    try:
        db = SentinelDB()
        print("[Pass] SentinelDB initialized")
    except Exception as e:
        print(f"[Fail] SentinelDB initialization failed: {e}")
        return

    # 1. Init Tables
    try:
        print("Attempting to initialize tables...")
        db.init_tables()
        print("[Pass] init_tables executed")
    except Exception as e:
        print(f"[Warn] init_tables failed (expected if no AWS creds/connection): {e}")
        # We continue to see if mock logic works or if it's just connection error

    # 2. Save Metric
    metric = {
        "server_id": "test-server-01",
        "cpu": 50.5,
        "memory": 60.0,
        "disk": 70.0,
        "network_in": 100.0,
        "network_out": 200.0,
        "timestamp": datetime.utcnow(),
    }
    try:
        db.save_metric(metric)
        print("[Pass] save_metric executed")
    except Exception as e:
        print(f"[Fail] save_metric failed: {e}")

    # 3. Save Log
    log = {
        "server_id": "test-server-01",
        "method": "GET",
        "path": "/test",
        "status": 200,
        "response_time": 50,
        "ip": "127.0.0.1",
        "user_agent": "test-agent",
        "timestamp": datetime.utcnow(),
    }
    try:
        db.save_log(log, "web")
        print("[Pass] save_log executed")
    except Exception as e:
        print(f"[Fail] save_log failed: {e}")

    print("--- Test Complete ---")


if __name__ == "__main__":
    test_dynamo_integration()
