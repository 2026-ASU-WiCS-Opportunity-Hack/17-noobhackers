"""Shared data models, constants, and JSON schemas for WIAL Lambda functions."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

STUDENT_ENROLLMENT_FEE: int = 50  # USD per enrolled student
COACH_CERTIFICATION_FEE: int = 30  # USD per certified coach

VALID_CERTIFICATION_LEVELS: List[str] = ["CALC", "PALC", "SALC", "MALC"]

VALID_ROLES: List[str] = [
    "Super_Admin",
    "Chapter_Lead",
    "Content_Creator",
    "Coach",
]

VALID_CHAPTER_STATUSES: List[str] = ["active", "inactive"]
VALID_COACH_STATUSES: List[str] = ["active", "pending_approval", "inactive"]
VALID_PAYMENT_STATUSES: List[str] = ["succeeded", "failed", "pending", "overdue"]
VALID_PAYMENT_METHODS: List[str] = ["stripe", "paypal"]
VALID_DUE_TYPES: List[str] = ["student_enrollment", "coach_certification"]

CORE_PAGES: List[str] = [
    "about",
    "coach-directory",
    "events",
    "team",
    "resources",
    "contact",
]


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------

@dataclass
class Chapter:
    chapter_id: str
    chapter_name: str
    slug: str
    region: str
    executive_director_email: str
    status: str = "active"
    external_link: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    created_by: Optional[str] = None


@dataclass
class Coach:
    coach_id: str
    cognito_user_id: str
    chapter_id: str
    name: str
    photo_url: str
    certification_level: str
    location: str
    contact_info: str
    bio: str
    languages: List[str] = field(default_factory=list)
    status: str = "active"
    pending_update: Optional[dict] = None
    embedding_version: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


@dataclass
class Payment:
    payment_id: str
    chapter_id: str
    payer_email: str
    payment_method: str
    due_type: str
    quantity: int
    unit_amount: int
    total_amount: int
    currency: str = "USD"
    status: str = "pending"
    stripe_payment_intent_id: Optional[str] = None
    paypal_order_id: Optional[str] = None
    due_date: Optional[str] = None
    reminders_sent: int = 0
    receipt_sent_at: Optional[str] = None
    created_at: Optional[str] = None
    failure_reason: Optional[str] = None


@dataclass
class Page:
    chapter_id: str
    page_slug: str
    title: str
    content: str = ""
    is_core_page: bool = False
    updated_by: Optional[str] = None
    updated_at: Optional[str] = None


@dataclass
class Template:
    version: int
    header_html: str
    footer_html: str
    nav_config: dict = field(default_factory=dict)
    global_styles: str = ""
    updated_by: Optional[str] = None
    updated_at: Optional[str] = None
    sync_status: str = "synced"


@dataclass
class User:
    cognito_user_id: str
    email: str
    role: str
    assigned_chapters: List[str] = field(default_factory=list)
    created_at: Optional[str] = None


# ---------------------------------------------------------------------------
# JSON Schemas (for use with shared/validators.py)
# ---------------------------------------------------------------------------

CHAPTER_SCHEMA: dict = {
    "type": "object",
    "required": ["chapterName", "slug", "region", "executiveDirectorEmail"],
    "properties": {
        "chapterName": {"type": "string", "minLength": 1, "maxLength": 200},
        "slug": {"type": "string", "minLength": 1, "maxLength": 50, "pattern": "^[a-z0-9-]+$"},
        "region": {"type": "string", "minLength": 1, "maxLength": 100},
        "executiveDirectorEmail": {"type": "string", "format": "email", "maxLength": 254},
        "externalLink": {"type": "string", "maxLength": 2048},
    },
    "additionalProperties": False,
}

COACH_SCHEMA: dict = {
    "type": "object",
    "required": ["name", "certificationLevel", "location", "contactInfo", "bio", "chapterId"],
    "properties": {
        "name": {"type": "string", "minLength": 1, "maxLength": 200},
        "chapterId": {"type": "string", "minLength": 1, "maxLength": 100},
        "photoUrl": {"type": "string", "maxLength": 2048},
        "certificationLevel": {"type": "string", "enum": VALID_CERTIFICATION_LEVELS},
        "location": {"type": "string", "minLength": 1, "maxLength": 200},
        "contactInfo": {"type": "string", "minLength": 1, "maxLength": 500},
        "bio": {"type": "string", "minLength": 1, "maxLength": 5000},
        "languages": {"type": "array", "items": {"type": "string", "maxLength": 50}},
    },
    "additionalProperties": False,
}

COACH_UPDATE_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "name": {"type": "string", "minLength": 1, "maxLength": 200},
        "photoUrl": {"type": "string", "maxLength": 2048},
        "location": {"type": "string", "minLength": 1, "maxLength": 200},
        "contactInfo": {"type": "string", "minLength": 1, "maxLength": 500},
        "bio": {"type": "string", "minLength": 1, "maxLength": 5000},
        "languages": {"type": "array", "items": {"type": "string", "maxLength": 50}},
    },
    "additionalProperties": False,
}

PAYMENT_SCHEMA: dict = {
    "type": "object",
    "required": ["chapterId", "paymentMethod", "dueType", "quantity", "payerEmail"],
    "properties": {
        "chapterId": {"type": "string", "minLength": 1, "maxLength": 100},
        "paymentMethod": {"type": "string", "enum": VALID_PAYMENT_METHODS},
        "dueType": {"type": "string", "enum": VALID_DUE_TYPES},
        "quantity": {"type": "integer", "minimum": 1, "maximum": 10000},
        "payerEmail": {"type": "string", "format": "email", "maxLength": 254},
    },
    "additionalProperties": False,
}

PAGE_SCHEMA: dict = {
    "type": "object",
    "required": ["title", "content"],
    "properties": {
        "title": {"type": "string", "minLength": 1, "maxLength": 200},
        "content": {"type": "string", "maxLength": 100000},
    },
    "additionalProperties": False,
}

TEMPLATE_SCHEMA: dict = {
    "type": "object",
    "required": ["headerHtml", "footerHtml", "navConfig", "globalStyles"],
    "properties": {
        "headerHtml": {"type": "string", "maxLength": 100000},
        "footerHtml": {"type": "string", "maxLength": 100000},
        "navConfig": {"type": "object"},
        "globalStyles": {"type": "string", "maxLength": 500000},
    },
    "additionalProperties": False,
}

USER_SCHEMA: dict = {
    "type": "object",
    "required": ["email", "role"],
    "properties": {
        "email": {"type": "string", "format": "email", "maxLength": 254},
        "role": {"type": "string", "enum": VALID_ROLES},
        "assignedChapters": {"type": "array", "items": {"type": "string", "maxLength": 100}},
    },
    "additionalProperties": False,
}
