"""Student-token → arm-id assignment lookup.

Resolution order:
1. PostgreSQL ``student_assignments`` table (if ``DATABASE_URL`` is set).
2. JSON file at ``server/student_assignments.json`` (fallback).

If the token is not found in either source a ``ValueError`` is raised.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

_ASSIGNMENTS_PATH = Path(__file__).resolve().parent.parent / "student_assignments.json"


async def get_arm_assignment(student_token: str) -> int:
    """Return the ``arm_id`` for *student_token*.

    Checks the DB first (if available), then the local JSON file.
    """
    db_url = os.environ.get("DATABASE_URL")
    if db_url:
        import asyncpg  # imported lazily so asyncpg is optional without DB

        conn = await asyncpg.connect(db_url)
        try:
            row = await conn.fetchrow(
                "SELECT arm_id FROM student_assignments WHERE student_token = $1",
                student_token,
            )
            if row is not None:
                return int(row["arm_id"])
        finally:
            await conn.close()

    # Fallback: JSON file
    if _ASSIGNMENTS_PATH.exists():
        data: dict[str, int] = json.loads(
            _ASSIGNMENTS_PATH.read_text(encoding="utf-8")
        )
        if student_token in data:
            return data[student_token]

    raise ValueError(
        f"Unknown student token: {student_token!r}. "
        "Register the token in student_assignments.json or the "
        "student_assignments database table."
    )
