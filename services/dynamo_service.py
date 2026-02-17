import boto3
import os
import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict
from boto3.dynamodb.conditions import Key, Attr
from decimal import Decimal


class SentinelDB:
    def __init__(self):
        # Initialize DynamoDB resource
        # Using environment variables for AWS credentials
        self.dynamodb = boto3.resource(
            "dynamodb",
            region_name=os.getenv("AWS_REGION", "us-east-1"),
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        )
        self.metrics_table = self.dynamodb.Table("SentinelMetrics")
        self.app_logs_table = self.dynamodb.Table("SentinelAppLogs")
        self.web_logs_table = self.dynamodb.Table("SentinelWebLogs")
        self.servers_table = self.dynamodb.Table("SentinelServers")
        self._known_servers = set()

    def init_tables(self):
        """Create tables if they don't exist"""
        existing_tables = [t.name for t in self.dynamodb.tables.all()]

        if "SentinelMetrics" not in existing_tables:
            self.dynamodb.create_table(
                TableName="SentinelMetrics",
                KeySchema=[
                    {"AttributeName": "server_id", "KeyType": "HASH"},  # Partition key
                    {"AttributeName": "timestamp", "KeyType": "RANGE"},  # Sort key
                ],
                AttributeDefinitions=[
                    {"AttributeName": "server_id", "AttributeType": "S"},
                    {"AttributeName": "timestamp", "AttributeType": "S"},
                ],
                ProvisionedThroughput={"ReadCapacityUnits": 5, "WriteCapacityUnits": 5},
            )

        if "SentinelAppLogs" not in existing_tables:
            self.dynamodb.create_table(
                TableName="SentinelAppLogs",
                KeySchema=[
                    {"AttributeName": "server_id", "KeyType": "HASH"},
                    {"AttributeName": "timestamp", "KeyType": "RANGE"},
                ],
                AttributeDefinitions=[
                    {"AttributeName": "server_id", "AttributeType": "S"},
                    {"AttributeName": "timestamp", "AttributeType": "S"},
                ],
                ProvisionedThroughput={"ReadCapacityUnits": 5, "WriteCapacityUnits": 5},
            )

        if "SentinelWebLogs" not in existing_tables:
            self.dynamodb.create_table(
                TableName="SentinelWebLogs",
                KeySchema=[
                    {"AttributeName": "server_id", "KeyType": "HASH"},
                    {"AttributeName": "timestamp", "KeyType": "RANGE"},
                ],
                AttributeDefinitions=[
                    {"AttributeName": "server_id", "AttributeType": "S"},
                    {"AttributeName": "timestamp", "AttributeType": "S"},
                ],
                ProvisionedThroughput={"ReadCapacityUnits": 5, "WriteCapacityUnits": 5},
            )

        if "SentinelServers" not in existing_tables:
            self.dynamodb.create_table(
                TableName="SentinelServers",
                KeySchema=[{"AttributeName": "id", "KeyType": "HASH"}],
                AttributeDefinitions=[{"AttributeName": "id", "AttributeType": "S"}],
                ProvisionedThroughput={"ReadCapacityUnits": 5, "WriteCapacityUnits": 5},
            )

    def save_metric(self, metric: Dict):
        """Save a metric to DynamoDB"""
        server_id = metric.get("server_id")

        # Auto-register server if unknown
        if server_id and server_id not in self._known_servers:
            # Check DB to be sure (in case of restart)
            resp = self.servers_table.get_item(Key={"id": server_id})
            if "Item" not in resp:
                print(f"Auto-registering new server: {server_id}")
                self.register_server(
                    {
                        "id": server_id,
                        "hostname": server_id,  # Default to ID as hostname
                        "ip": "unknown",
                        "os": "unknown",
                        "status": "active",
                        "agentVersion": "unknown",
                        "last_seen": datetime.utcnow().isoformat(),
                    }
                )
            self._known_servers.add(server_id)

        # Convert timestamp to string if it's a datetime object
        if isinstance(metric.get("timestamp"), datetime):
            metric["timestamp"] = metric["timestamp"].isoformat()

        # DynamoDB requires Decimal for floats
        for key, value in metric.items():
            if isinstance(value, float):
                metric[key] = Decimal(str(value))

        self.metrics_table.put_item(Item=metric)
        # Also update server last seen/status if needed (optional optimization)

    def save_log(self, log_entry: Dict, log_type: str):
        """Save a log entry (web or app)"""
        if isinstance(log_entry.get("timestamp"), datetime):
            log_entry["timestamp"] = log_entry["timestamp"].isoformat()

        log_entry["type"] = log_type  # 'web' or 'app'
        if "id" not in log_entry:
            log_entry["id"] = str(uuid.uuid4())

        if log_type == "web":
            self.web_logs_table.put_item(Item=log_entry)
        else:
            self.app_logs_table.put_item(Item=log_entry)

    def register_server(self, server_info: Dict):
        """Update or register a server"""
        self.servers_table.put_item(Item=server_info)

    def get_server_metrics(self, server_id: str, limit: int = 30) -> List[Dict]:
        """Query metrics for a server"""
        # Query last N items. DynamoDB Query is forward by default,
        # but to get the *latest* we often query in reverse or use a time window.
        # Here we'll query the last 24 hours to be safe and take the last 'limit'.

        # Simple approach: Query with ScanIndexForward=False to get latest first
        response = self.metrics_table.query(
            KeyConditionExpression=Key("server_id").eq(server_id),
            ScanIndexForward=False,
            Limit=limit,
        )
        # Reverse back to return chronological order if preferred by frontend
        items = response.get("Items", [])
        return sorted(items, key=lambda x: x["timestamp"])

    def get_logs(
        self, log_type: str, server_id: Optional[str] = None, limit: int = 50
    ) -> List[Dict]:
        """Query logs, optionally filtered by server"""
        target_table = self.web_logs_table if log_type == "web" else self.app_logs_table

        if server_id:
            response = target_table.query(
                KeyConditionExpression=Key("server_id").eq(server_id),
                ScanIndexForward=False,
                Limit=limit,
            )
            return response.get("Items", [])
        else:
            # Scan! Now efficient as tables are split
            # We scan more than limit to increase chance of getting recent items if possible,
            # but ultimately Scan order is undefined.
            response = target_table.scan(Limit=limit * 5)
            items = sorted(
                response.get("Items", []), key=lambda x: x["timestamp"], reverse=True
            )
            return items[:limit]

    def get_all_servers(self) -> List[Dict]:
        """Scan all servers"""
        response = self.servers_table.scan()
        return response.get("Items", [])
