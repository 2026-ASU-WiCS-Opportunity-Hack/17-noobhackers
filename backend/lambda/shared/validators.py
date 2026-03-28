"""Input validation and sanitization for WIAL Lambda functions."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from shared.exceptions import ValidationError


# ---------------------------------------------------------------------------
# Dangerous content patterns
# ---------------------------------------------------------------------------

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_SCRIPT_RE = re.compile(r"<\s*script[^>]*>.*?<\s*/\s*script\s*>", re.IGNORECASE | re.DOTALL)
_EVENT_HANDLER_RE = re.compile(r"\bon\w+\s*=", re.IGNORECASE)

_SQL_INJECTION_PATTERNS: List[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)\b\s)",
        r"(--|;)\s*(DROP|ALTER|DELETE|UPDATE|INSERT|SELECT)",
        r"'\s*(OR|AND)\s+'",
        r"'\s*(OR|AND)\s+\d",
        r"UNION\s+(ALL\s+)?SELECT",
    ]
]

# Simple email format check (RFC 5322 simplified)
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ---------------------------------------------------------------------------
# Sanitization helpers
# ---------------------------------------------------------------------------

def strip_html_tags(value: str) -> str:
    """Remove all HTML tags from a string."""
    return _HTML_TAG_RE.sub("", value)


def sanitize_string(value: str) -> str:
    """Strip HTML tags, script blocks, and event handlers from a string."""
    value = _SCRIPT_RE.sub("", value)
    value = _EVENT_HANDLER_RE.sub("", value)
    value = strip_html_tags(value)
    return value.strip()


def contains_sql_injection(value: str) -> bool:
    """Return True if the value matches common SQL injection patterns."""
    return any(p.search(value) for p in _SQL_INJECTION_PATTERNS)


# ---------------------------------------------------------------------------
# Schema validation
# ---------------------------------------------------------------------------

def _validate_type(value: Any, expected_type: str, field_path: str) -> List[str]:
    """Validate a value against a JSON-schema type keyword."""
    errors: List[str] = []
    type_map = {
        "string": str,
        "integer": int,
        "number": (int, float),
        "boolean": bool,
        "array": list,
        "object": dict,
    }
    py_type = type_map.get(expected_type)
    if py_type and not isinstance(value, py_type):
        errors.append(f"{field_path}: expected type '{expected_type}', got '{type(value).__name__}'")
    # Reject booleans masquerading as integers
    if expected_type == "integer" and isinstance(value, bool):
        errors.append(f"{field_path}: expected type 'integer', got 'bool'")
    return errors


def _validate_field(
    value: Any,
    schema: Dict[str, Any],
    field_path: str,
) -> List[str]:
    """Validate a single value against its field schema. Returns error messages."""
    errors: List[str] = []

    if value is None:
        return errors

    # Type check
    expected_type = schema.get("type")
    if expected_type:
        errors.extend(_validate_type(value, expected_type, field_path))
        if errors:
            return errors  # Skip further checks if type is wrong

    # String constraints
    if isinstance(value, str):
        min_len = schema.get("minLength")
        max_len = schema.get("maxLength")
        if min_len is not None and len(value) < min_len:
            errors.append(f"{field_path}: length {len(value)} is below minimum {min_len}")
        if max_len is not None and len(value) > max_len:
            errors.append(f"{field_path}: length {len(value)} exceeds maximum {max_len}")

        pattern = schema.get("pattern")
        if pattern and not re.fullmatch(pattern, value):
            errors.append(f"{field_path}: value does not match pattern '{pattern}'")

        fmt = schema.get("format")
        if fmt == "email" and not _EMAIL_RE.match(value):
            errors.append(f"{field_path}: invalid email format")

        enum = schema.get("enum")
        if enum and value not in enum:
            errors.append(f"{field_path}: value '{value}' not in allowed values {enum}")

        # SQL injection check on all string fields
        if contains_sql_injection(value):
            errors.append(f"{field_path}: potential SQL injection detected")

    # Numeric constraints
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        minimum = schema.get("minimum")
        maximum = schema.get("maximum")
        if minimum is not None and value < minimum:
            errors.append(f"{field_path}: value {value} is below minimum {minimum}")
        if maximum is not None and value > maximum:
            errors.append(f"{field_path}: value {value} exceeds maximum {maximum}")

    # Enum for non-strings
    if not isinstance(value, str):
        enum = schema.get("enum")
        if enum and value not in enum:
            errors.append(f"{field_path}: value not in allowed values {enum}")

    # Array items
    if isinstance(value, list):
        items_schema = schema.get("items")
        if items_schema:
            for i, item in enumerate(value):
                errors.extend(_validate_field(item, items_schema, f"{field_path}[{i}]"))

    # Nested object
    if isinstance(value, dict) and expected_type == "object":
        nested_props = schema.get("properties", {})
        nested_required = schema.get("required", [])
        for req_field in nested_required:
            if req_field not in value:
                errors.append(f"{field_path}.{req_field}: required field missing")
        for k, v in value.items():
            if k in nested_props:
                errors.extend(_validate_field(v, nested_props[k], f"{field_path}.{k}"))
            elif schema.get("additionalProperties") is False:
                errors.append(f"{field_path}.{k}: unexpected field")

    return errors


def validate_input(data: Any, schema: Dict[str, Any]) -> Dict[str, Any]:
    """Validate and sanitize input data against a JSON schema.

    Returns the sanitized data dict on success.
    Raises ``ValidationError`` with a descriptive message on failure.
    """
    errors: List[str] = []

    if not isinstance(data, dict):
        raise ValidationError("Input must be a JSON object")

    # Check required fields
    for req_field in schema.get("required", []):
        if req_field not in data:
            errors.append(f"{req_field}: required field missing")

    # Check for unexpected fields
    properties = schema.get("properties", {})
    if schema.get("additionalProperties") is False:
        for key in data:
            if key not in properties:
                errors.append(f"{key}: unexpected field")

    # Validate and sanitize each field
    sanitized: Dict[str, Any] = {}
    for key, value in data.items():
        field_schema = properties.get(key, {})
        errors.extend(_validate_field(value, field_schema, key))

        # Sanitize string values
        if isinstance(value, str):
            sanitized[key] = sanitize_string(value)
        elif isinstance(value, list):
            sanitized[key] = [
                sanitize_string(item) if isinstance(item, str) else item
                for item in value
            ]
        else:
            sanitized[key] = value

    if errors:
        raise ValidationError("; ".join(errors))

    return sanitized
