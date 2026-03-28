"""PII redaction filter for CloudWatch log output.

Replaces names, emails, and phone numbers with [REDACTED] before
log records are written to CloudWatch.
"""

from __future__ import annotations

import copy
import re
from typing import Any, Dict, Set

REDACTED = "[REDACTED]"

# Regex patterns for PII value detection
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_PHONE_RE = re.compile(
    r"(\+?\d{1,3}[\s.-]?)?"       # optional country code
    r"(\(?\d{2,4}\)?[\s.-]?)?"    # optional area code
    r"\d{3,4}[\s.-]?\d{3,4}"     # main number
)

# Field names that are known to contain PII
_PII_FIELD_NAMES: Set[str] = {
    "name",
    "email",
    "phone",
    "phone_number",
    "phoneNumber",
    "contactInfo",
    "contact_info",
    "payerEmail",
    "payer_email",
    "executiveDirectorEmail",
    "executive_director_email",
}


def _is_pii_field(key: str) -> bool:
    """Return True if the field name is a known PII field."""
    lower = key.lower()
    return (
        key in _PII_FIELD_NAMES
        or "email" in lower
        or "phone" in lower
        or lower == "name"
        or lower.endswith("_name")
        or lower.endswith("name")
    )


def _redact_value(value: Any) -> Any:
    """Redact PII patterns from a string value."""
    if not isinstance(value, str):
        return value
    result = _EMAIL_RE.sub(REDACTED, value)
    result = _PHONE_RE.sub(REDACTED, result)
    return result


def redact_pii(log_record: Dict[str, Any]) -> Dict[str, Any]:
    """Return a copy of *log_record* with PII fields replaced by [REDACTED].

    - Fields whose *name* matches a known PII field have their entire
      value replaced with ``[REDACTED]``.
    - String values in non-PII fields are scanned for email and phone
      patterns which are individually replaced.
    - Non-PII, non-string fields are preserved unchanged.
    - Nested dicts are processed recursively.
    """
    redacted: Dict[str, Any] = {}
    for key, value in log_record.items():
        if _is_pii_field(key):
            redacted[key] = REDACTED
        elif isinstance(value, dict):
            redacted[key] = redact_pii(value)
        elif isinstance(value, list):
            redacted[key] = [
                redact_pii(item) if isinstance(item, dict) else _redact_value(item)
                for item in value
            ]
        elif isinstance(value, str):
            redacted[key] = _redact_value(value)
        else:
            redacted[key] = value
    return redacted
