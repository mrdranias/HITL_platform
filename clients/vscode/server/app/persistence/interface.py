"""Abstract persistence interface.

Any concrete store (JSONL, PostgreSQL, etc.) must implement this protocol.
"""

from __future__ import annotations

from typing import Protocol

from ..schemas import AgentRequestEnvelope, InstructionalResponseEnvelope


class PersistenceStore(Protocol):
    """Minimal persistence contract for the HITL gateway."""

    async def create_session(
        self,
        session_id: str,
        student_id: str,
        project_id: str,
        arm_id: int,
        client_version: str,
    ) -> None:
        """Record the start of a new session."""
        ...

    async def log_interaction(
        self,
        request: AgentRequestEnvelope,
        response: InstructionalResponseEnvelope,
        interaction_index: int,
    ) -> None:
        """Record a completed request/response pair."""
        ...

    async def log_error(
        self,
        session_id: str,
        message: str,
    ) -> None:
        """Record an error event."""
        ...
