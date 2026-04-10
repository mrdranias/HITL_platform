"""JSONL file-based persistence implementation.

Writes one JSON object per line to ``<data_dir>/hitl_log.jsonl``.
Thread-safe via ``asyncio.Lock``.  Designed to be swapped out for
PostgreSQL later without changing call sites.
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path

from ..schemas import AgentRequestEnvelope, InstructionalResponseEnvelope


class JsonlStore:
    """File-backed :class:`PersistenceStore` implementation."""

    def __init__(self, data_dir: str | Path | None = None) -> None:
        if data_dir is None:
            data_dir = Path(__file__).resolve().parent.parent.parent / "data"
        self._path = Path(data_dir) / "hitl_log.jsonl"
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = asyncio.Lock()

    async def create_session(
        self,
        session_id: str,
        student_id: str,
        project_id: str,
        arm_id: int,
        client_version: str,
    ) -> None:
        await self._append({
            "event": "session_start",
            "timestamp": _now(),
            "session_id": session_id,
            "student_id": student_id,
            "project_id": project_id,
            "arm_id": arm_id,
            "client_version": client_version,
        })

    async def log_interaction(
        self,
        request: AgentRequestEnvelope,
        response: InstructionalResponseEnvelope,
        interaction_index: int,
    ) -> None:
        await self._append({
            "event": "interaction",
            "timestamp": _now(),
            "session_id": request.session_id,
            "project_id": request.project_id,
            "arm_id": request.arm_id,
            "interaction_index": interaction_index,
            "workflow_landmark": request.workflow_landmark,
            "request_messages": [m.model_dump() for m in request.messages],
            "response_content": response.response_content,
            "drift_injected": response.drift_injected,
            "intervention_id": response.intervention_id,
            "original_response_hash": response.original_response_hash,
        })

    async def log_error(
        self,
        session_id: str,
        message: str,
    ) -> None:
        await self._append({
            "event": "error",
            "timestamp": _now(),
            "session_id": session_id,
            "message": message,
        })

    # ------------------------------------------------------------------
    async def _append(self, record: dict) -> None:
        line = json.dumps(record, default=str) + "\n"
        async with self._lock:
            with open(self._path, "a", encoding="utf-8") as f:
                f.write(line)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
