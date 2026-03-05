import os
from datetime import datetime
from typing import List, Optional, Dict
from motor.motor_asyncio import AsyncIOMotorClient


class SentinelDB:
    def __init__(self):
        # Initialize MongoDB client
        mongo_uri = os.getenv("MONGO_URI")
        if not mongo_uri:
            raise ValueError("MONGO_URI environment variable is not set")

        self.client = AsyncIOMotorClient(mongo_uri)
        # Assuming we want to name the database 'sentinel' or extract from URI if present
        # If the URI contains a DB name it will be used by default, here we explicitly use 'sentinel'
        self.db = self.client.get_default_database("sentinel")

        # Collections
        self.metrics_col = self.db.get_collection("metrics")
        self.app_logs_col = self.db.get_collection("app_logs")
        self.web_logs_col = self.db.get_collection("web_logs")
        self.servers_col = self.db.get_collection("servers")
        self._known_servers = set()

    async def init_tables(self):
        """Create indexes if they don't exist"""
        import pymongo

        await self.metrics_col.create_index(
            [("server_id", pymongo.ASCENDING), ("timestamp", pymongo.DESCENDING)]
        )
        await self.app_logs_col.create_index(
            [("server_id", pymongo.ASCENDING), ("timestamp", pymongo.DESCENDING)]
        )
        await self.web_logs_col.create_index(
            [("server_id", pymongo.ASCENDING), ("timestamp", pymongo.DESCENDING)]
        )

        # In MongoDB, the _id field is always indexed.
        # But we use 'id' as our primary identifier, so we can index it.
        await self.servers_col.create_index("id", unique=True)

        # Pre-load known servers into memory
        cursor = self.servers_col.find({}, {"id": 1})
        async for doc in cursor:
            self._known_servers.add(doc["id"])

    async def save_metric(self, metric: Dict):
        """Save a metric to MongoDB"""
        server_id = metric.get("server_id")

        # Auto-register server if unknown
        if server_id and server_id not in self._known_servers:
            # Check DB to be sure (in case of restart/multiple instances)
            existing_server = await self.servers_col.find_one({"id": server_id})
            if not existing_server:
                print(f"Auto-registering new server: {server_id}")
                await self.register_server(
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

        # In MongoDB, we don't need to manually stringify floats to Decimal like DynamoDB
        await self.metrics_col.insert_one(metric)
        # Remove the inserted `_id` so we don't mutate the dictionary for the caller
        if "_id" in metric:
            del metric["_id"]

    async def save_log(self, log_entry: Dict, log_type: str):
        """Save a log entry (web or app)"""
        if isinstance(log_entry.get("timestamp"), datetime):
            log_entry["timestamp"] = log_entry["timestamp"].isoformat()

        log_entry["type"] = log_type  # 'web' or 'app'

        if log_type == "web":
            await self.web_logs_col.insert_one(log_entry)
        else:
            await self.app_logs_col.insert_one(log_entry)

        # Cleanup injected ObjectId to keep the response clean
        if "_id" in log_entry:
            del log_entry["_id"]

    async def register_server(self, server_info: Dict):
        """Update or register a server"""
        await self.servers_col.update_one(
            {"id": server_info["id"]}, {"$set": server_info}, upsert=True
        )

    async def get_server_metrics(self, server_id: str, limit: int = 30) -> List[Dict]:
        """Query metrics for a server"""
        cursor = (
            self.metrics_col.find({"server_id": server_id})
            .sort("timestamp", -1)
            .limit(limit)
        )
        items = await cursor.to_list(length=limit)

        # Remove MongoDB _id from results
        for item in items:
            item.pop("_id", None)

        # Reverse back to return chronological order if preferred by frontend
        return sorted(items, key=lambda x: x.get("timestamp", ""))

    async def get_logs(
        self, log_type: str, server_id: Optional[str] = None, limit: int = 50
    ) -> List[Dict]:
        """Query logs, optionally filtered by server"""
        target_col = self.web_logs_col if log_type == "web" else self.app_logs_col

        query = {}
        if server_id:
            query["server_id"] = server_id

        cursor = target_col.find(query).sort("timestamp", -1).limit(limit)
        items = await cursor.to_list(length=limit)

        # Remove MongoDB _id from results
        for item in items:
            item.pop("_id", None)

        return items

    async def get_all_servers(self) -> List[Dict]:
        """Scan all servers"""
        cursor = self.servers_col.find({})
        items = await cursor.to_list(length=1000)  # Arbitrary max limit

        for item in items:
            item.pop("_id", None)

        return items
