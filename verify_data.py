import os
from dotenv import load_dotenv
import boto3
from boto3.dynamodb.conditions import Attr

load_dotenv()

# Initialize DynamoDB resource
dynamodb = boto3.resource(
    "dynamodb",
    region_name=os.getenv("AWS_REGION", "us-east-1"),
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
)

logs_table = dynamodb.Table("SentinelLogs")


def verify_logs():
    print("Verifying 'web' logs...")
    log_type = "web"
    items = []
    params = {
        "FilterExpression": Attr("type").eq(log_type),
    }

    while True:
        print(f"Scanning... StartKey: {params.get('ExclusiveStartKey')}")
        response = logs_table.scan(**params)
        batch = response.get("Items", [])
        items.extend(batch)
        print(f"Found {len(batch)} items in this batch.")

        if "LastEvaluatedKey" not in response or len(items) >= 50 * 5:
            break

        params["ExclusiveStartKey"] = response["LastEvaluatedKey"]

    print(f"Total 'web' logs found: {len(items)}")
    for item in items[:3]:
        print(f"Sample: {item}")


if __name__ == "__main__":
    verify_logs()
