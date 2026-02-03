"""
Shared utilities for offer scrapers.
OEM date format convention: UTC ISO-8601.
"""

from datetime import datetime, timezone
from typing import Optional


def to_utc_iso8601(dt: Optional[datetime]) -> Optional[str]:
    """
    Serialize a datetime to UTC ISO-8601 string.
    Naive datetimes are treated as UTC.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.isoformat()
