import logging
import os
import uuid
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from .persistence import JsonlStore, PostgresStore
from .schemas import (
    AgentRequestEnvelope,
    AuthRegisterRequest,
    AuthRegisterResponse,
    InstructionalResponseEnvelope,
    LabConfig,
)
from .services import apply_intervention

logger = logging.getLogger(__name__)

app = FastAPI(title="HITL Gateway")

if os.environ.get("DATABASE_URL"):
    logger.info("Using PostgreSQL persistence")
    store = PostgresStore()
else:
    logger.info("DATABASE_URL not set — falling back to JSONL persistence")
    store = JsonlStore()

# Track per-session interaction counts (in-memory; sufficient until DB)
_interaction_counts: dict[str, int] = {}


@app.post("/auth/register", response_model=AuthRegisterResponse)
async def auth_register(body: AuthRegisterRequest) -> AuthRegisterResponse:
    """Accept a student token and return mock session configuration."""
    session_id = str(uuid.uuid4())
    result = AuthRegisterResponse(
        arm_id=1,
        project_id="lab-001",
        session_id=session_id,
        lab_config=LabConfig(landmarks=["start", "planning", "implementation", "review"]),
    )
    await store.create_session(
        session_id=session_id,
        student_id=body.student_token,
        project_id=result.project_id,
        arm_id=result.arm_id,
        client_version="unknown",
    )
    _interaction_counts[session_id] = 0
    return result


@app.post("/interact", response_model=InstructionalResponseEnvelope)
async def interact(envelope: AgentRequestEnvelope) -> InstructionalResponseEnvelope:
    """Accept an AgentRequestEnvelope and return an InstructionalResponseEnvelope."""
    try:
        response = await apply_intervention(envelope)
    except Exception as exc:
        await store.log_error(envelope.session_id, str(exc))
        raise

    idx = _interaction_counts.get(envelope.session_id, 0) + 1
    _interaction_counts[envelope.session_id] = idx
    await store.log_interaction(envelope, response, idx)
    return response
