import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def check_db():
    load_dotenv()
    mongo_uri = os.getenv("MONGO_URI")
    client = AsyncIOMotorClient(mongo_uri)
    db = client.get_default_database("sentinel")
    
    for col_name in ["app_logs", "web_logs"]:
        col = db.get_collection(col_name)
        count = await col.count_documents({})
        print(f"Collection: {col_name}")
        print(f"  Count: {count}")
        indexes = await col.index_information()
        print(f"  Indexes: {indexes}")
        
        # Explain the query
        query = {}
        sort = [("timestamp", -1)]
        explain = await col.find(query).sort(sort).limit(50).explain()
        winning_plan = explain.get("queryPlanner", {}).get("winningPlan", {})
        print(f"  Winning Plan for query {query} sort {sort}:")
        # print(winning_plan) # Might be too verbose
        
        # Check if it's using a COLLSCAN
        def check_collscan(plan):
            if plan.get("stage") == "COLLSCAN":
                return True
            if "inputStage" in plan:
                return check_collscan(plan["inputStage"])
            return False
        
        if check_collscan(winning_plan):
            print("  WARNING: COLLSCAN detected!")
        else:
            print("  Index used.")
        print("-" * 20)

if __name__ == "__main__":
    asyncio.run(check_db())
