import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def check_conn():
    load_dotenv()
    mongo_uri = os.getenv("MONGO_URI")
    print(f"Connecting to {mongo_uri[:20]}...")
    client = AsyncIOMotorClient(mongo_uri)
    try:
        # The ismaster command is cheap and does not require auth.
        await client.admin.command('ismaster')
        print("Connected successfully")
        db = client.get_default_database("sentinel")
        collections = await db.list_collection_names()
        print(f"Collections: {collections}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_conn())
