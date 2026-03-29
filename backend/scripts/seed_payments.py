#!/usr/bin/env python3
"""Seed dummy payment data for a chapter.

Usage:
  python scripts/seed_payments.py <chapter_slug>
  python scripts/seed_payments.py brazil
  python scripts/seed_payments.py --all   # seed all active chapters

Writes to the wial-payments DynamoDB table in us-east-2.
"""

import sys
import uuid
import random
from datetime import datetime, timezone, timedelta

import boto3
from boto3.dynamodb.conditions import Key

REGION = "us-east-2"
PAYMENTS_TABLE = "wial-payments"
CHAPTERS_TABLE = "wial-chapters"

dynamodb = boto3.resource("dynamodb", region_name=REGION)
payments_table = dynamodb.Table(PAYMENTS_TABLE)
chapters_table = dynamodb.Table(CHAPTERS_TABLE)

PAYER_NAMES = [
    "affiliate-admin", "training-dept", "hr-director",
    "education-office", "regional-manager",
]

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def random_date(days_back=90):
    d = datetime.now(timezone.utc) - timedelta(days=random.randint(1, days_back))
    return d.isoformat()

def get_chapter_id(slug: str) -> str:
    """Look up chapterId from slug."""
    resp = chapters_table.scan(
        FilterExpression="slug = :slug AND SK = :sk",
        ExpressionAttributeValues={":slug": slug, ":sk": "METADATA"},
        Limit=10,
    )
    items = resp.get("Items", [])
    if not items:
        print(f"ERROR: Chapter with slug '{slug}' not found.")
        sys.exit(1)
    return items[0]["chapterId"]


def get_all_chapter_slugs() -> list:
    """Return all active chapter slugs."""
    resp = chapters_table.scan(
        FilterExpression="SK = :sk AND #s = :active",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":sk": "METADATA", ":active": "active"},
    )
    return [item["slug"] for item in resp.get("Items", [])]


def seed_payments(chapter_id: str, slug: str, count: int = 8):
    """Create dummy payment records for a chapter."""
    created = 0
    for i in range(count):
        payment_id = str(uuid.uuid4())
        due_type = random.choice(["student_enrollment", "coach_certification"])
        quantity = random.randint(1, 10)
        unit_amount = 50 if due_type == "student_enrollment" else 30
        total = quantity * unit_amount
        method = random.choice(["stripe", "paypal"])
        status = random.choices(
            ["succeeded", "pending", "overdue", "failed"],
            weights=[60, 15, 15, 10],
        )[0]
        payer = f"{random.choice(PAYER_NAMES)}@{slug}.wial.org"
        created_at = random_date()

        item = {
            "PK": f"PAYMENT#{payment_id}",
            "SK": "RECORD",
            "paymentId": payment_id,
            "chapterId": chapter_id,
            "payerEmail": payer,
            "paymentMethod": method,
            "dueType": due_type,
            "quantity": quantity,
            "unitAmount": unit_amount,
            "totalAmount": total,
            "currency": "USD",
            "status": status,
            "remindersSent": 0,
            "createdAt": created_at,
        }

        if status == "overdue":
            due_date = (datetime.now(timezone.utc) - timedelta(days=random.randint(8, 35))).isoformat()
            item["dueDate"] = due_date
            item["remindersSent"] = random.randint(0, 2)

        if status == "succeeded":
            item["receiptSentAt"] = created_at

        if method == "stripe":
            item["stripePaymentIntentId"] = f"pi_{uuid.uuid4().hex[:24]}"
        else:
            item["paypalOrderId"] = f"PAY-{uuid.uuid4().hex[:20].upper()}"

        payments_table.put_item(Item=item)
        created += 1

    print(f"  Created {created} payments for {slug} (chapterId: {chapter_id})")
    return created


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/seed_payments.py <chapter_slug|--all>")
        sys.exit(1)

    arg = sys.argv[1]

    if arg == "--all":
        slugs = get_all_chapter_slugs()
        if not slugs:
            print("No active chapters found.")
            sys.exit(1)
        print(f"Seeding payments for {len(slugs)} chapters...")
        total = 0
        for slug in slugs:
            cid = get_chapter_id(slug)
            total += seed_payments(cid, slug)
        print(f"\nDone. {total} total payments seeded.")
    else:
        slug = arg.lower()
        print(f"Seeding payments for '{slug}'...")
        cid = get_chapter_id(slug)
        seed_payments(cid, slug)
        print("Done.")


if __name__ == "__main__":
    main()
