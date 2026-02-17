import os
from dotenv import load_dotenv

load_dotenv()

print(f"Loaded AWS_REGION: {os.getenv('AWS_REGION')}")
if os.getenv("AWS_REGION") == "us-east-1":
    print("SUCCESS: AWS_REGION is us-east-1")
else:
    print("WARNING: AWS_REGION is not us-east-1")
