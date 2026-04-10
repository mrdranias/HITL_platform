"""PostgreSQL-backed persistence implementation.

Reads ``DATABASE_URL`` from the environment.  Creates the three required
tables (``sessions``, ``interactions``, ``error_events``) if they do not
already exist.  Uses ``asyncpg`` for all database access.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

import asyncpg

from ..schemas import AgentRequestEnvelope, InstructionalResponseEnvelope

_SCHEMA_PATH = Path(__file__).resolve().parent.parent.parent / "schema.sql"


class PostgresStore:
    """PostgreSQL :class:`PersistenceStore` implementation."""

    def __init__(self) -> None:
        self._pool: asyncpg.Pool | None = None
        self._dsn = os.environ.get("DATABASE_URL", "")
        if not self._dsn:
            raise RuntimeError(
                "DATABASE_URL environment variable is not set. "
                "The server cannot use PostgreSQL persistence without it."
            )

    async def _get_pool(self) -> asyncpg.Pool:
        if self._pool is None:
            self._pool = await asyncpg.create_pool(self._dsn, min_size=1, max_size=5)
            ddl = _SCHEMA_PATH.read_text(encoding="utf-8")
            async with self._pool.acquire() as conn:
                await conn.execute(ddl)
        return self._pool

    async def create_session(
        self,
        session_id: str,
        student_id: str,
        project_id: str,
        arm_id: int,
        client_version: str,
    ) -> None:
        pool = await self._get_pool()
        await pool.execute(
            """
            INSERT INTO sessions (session_id, student_id, project_id, arm_id, client_version)
            VALUES ($1, $2, $3, $4, $5)
            """,
            session_id, student_id, project_id, arm_id, client_version,
        )

    async def log_interaction(
        self,
        request: AgentRequestEnvelope,
        response: InstructionalResponseEnvelope,
        interaction_index: int,
    ) -> None:
        pool = await self._get_pool()
        request_json = json.dumps(request.model_dump(), default=str)
        response_json = json.dumps(response.model_dump(), default=str)
        await pool.execute(
            """
            INSERT INTO interactions (
                session_id, interaction_index,
                request_json, response_json,
                workflow_landmark, planning_document,
                drift_injected, intervention_id, original_response_hash,
                request_timestamp, server_timestamp
            ) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7, $8, $9, $10, $11)
            """,
            request.session_id,
            interaction_index,
            request_json,
            response_json,
            request.workflow_landmark,
            request.planning_document,
            response.drift_injected,
            response.intervention_id,
            response.original_response_hash,
            request.timestamp.replace(tzinfo=timezone.utc) if request.timestamp.tzinfo is None else request.timestamp,
            response.server_timestamp.replace(tzinfo=timezone.utc) if response.server_timestamp.tzinfo is None else response.server_timestamp,
        )

    async def log_error(
        self,
        session_id: str,
        message: str,
    ) -> None:
        pool = await self._get_pool()
        await pool.execute(
            """
            INSERT INTO error_events (session_id, message)
            VALUES ($1, $2)
            """,
            session_id, message,
        )

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None
