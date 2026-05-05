import asyncio
from unittest.mock import MagicMock, AsyncMock
from services.mongo_service import SentinelDB
from datetime import datetime

class AsyncIterator:
    def __init__(self, items):
        self.items = iter(items)
    def __aiter__(self):
        return self
    async def __anext__(self):
        try:
            return next(self.items)
        except StopIteration:
            raise StopAsyncIteration

async def test_logic():
    # Mock AsyncIOMotorClient
    mock_client = MagicMock()
    mock_db = MagicMock()
    mock_client.get_default_database.return_value = mock_db
    
    # Mock collections
    mock_metrics = AsyncMock()
    mock_app_logs = AsyncMock()
    mock_web_logs = AsyncMock()
    mock_servers = AsyncMock()
    
    # Mock find to return an async iterator
    mock_servers.find.return_value = AsyncIterator([])
    
    mock_db.get_collection.side_effect = lambda name: {
        "metrics": mock_metrics,
        "app_logs": mock_app_logs,
        "web_logs": mock_web_logs,
        "servers": mock_servers
    }[name]
    
    # Patch os.getenv and AsyncIOMotorClient
    import os
    original_getenv = os.getenv
    os.getenv = lambda key, default=None: "mongodb://mock" if key == "MONGO_URI" else original_getenv(key, default)
    
    import services.mongo_service
    services.mongo_service.AsyncIOMotorClient = lambda uri: mock_client
    
    db = SentinelDB()
    
    # Test init_tables
    await db.init_tables()
    print("init_tables called successfully")
    
    # Verify indexes
    # 2 calls for metrics (composite + standalone), 2 for app_logs, 2 for web_logs
    print(f"Total create_index calls on metrics: {mock_metrics.create_index.call_count}")
    print(f"Total create_index calls on app_logs: {mock_app_logs.create_index.call_count}")
    assert mock_metrics.create_index.call_count == 2
    assert mock_app_logs.create_index.call_count == 2
    
    # Test save_log with datetime
    now = datetime.utcnow()
    log_entry = {"server_id": "test", "message": "hello", "timestamp": now}
    await db.save_log(log_entry, "app")
    
    # Verify that timestamp is still a datetime object in the call
    inserted_doc = mock_app_logs.insert_one.call_args[0][0]
    print(f"Stored timestamp type: {type(inserted_doc['timestamp'])}")
    assert isinstance(inserted_doc['timestamp'], datetime)
    
    print("Logic verification complete")

if __name__ == "__main__":
    asyncio.run(test_logic())
