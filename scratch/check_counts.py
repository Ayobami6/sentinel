import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def check_counts():
    load_dotenv()
    mongo_uri = os.getenv("MONGO_URI")
    client = AsyncIOMotorClient(mongo_uri)
    db = client.get_default_database("sentinel")
    
    for col_name in ["app_logs", "web_logs"]:
        col = db.get_collection(col_name)
        try:
            count = await col.count_documents({})
            print(f"{col_name}: {count}")
        except Exception as e:
            print(f"Error {col_name}: {e}")

if __name__ == "__main__":
    asyncio.run(check_counts())
