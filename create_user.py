#!/usr/bin/env python3
"""
Script to create a login user in the Sentinel MongoDB users collection.

Usage:
    python create_user.py --username <username> --password <password>
    python create_user.py  # prompts interactively
"""

import argparse
import asyncio
import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

# Import password hasher from auth service
sys.path.insert(0, os.path.dirname(__file__))
from services.auth_service import hash_password


async def create_user(username: str, password: str) -> None:
    mongo_uri = os.getenv("MONGO_URI")
    if not mongo_uri:
        print("ERROR: MONGO_URI environment variable is not set.")
        sys.exit(1)

    client = AsyncIOMotorClient(mongo_uri)
    db = client.get_default_database("sentinel")
    users_col = db["users"]

    existing = await users_col.find_one({"username": username})
    if existing:
        print(f"ERROR: User '{username}' already exists.")
        client.close()
        sys.exit(1)

    user_doc = {
        "username": username,
        "hashed_password": hash_password(password),
        "created_at": datetime.now(tz=timezone.utc),
        "is_active": True,
    }

    await users_col.insert_one(user_doc)
    print(f"User '{username}' created successfully.")
    client.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a Sentinel dashboard user")
    parser.add_argument("--username", help="Username for the new account")
    parser.add_argument("--password", help="Password for the new account")
    args = parser.parse_args()

    username = args.username or input("Username: ").strip()
    if not username:
        print("ERROR: Username cannot be empty.")
        sys.exit(1)

    import getpass

    password = args.password or getpass.getpass("Password: ")
    if not password:
        print("ERROR: Password cannot be empty.")
        sys.exit(1)

    asyncio.run(create_user(username, password))


if __name__ == "__main__":
    main()
