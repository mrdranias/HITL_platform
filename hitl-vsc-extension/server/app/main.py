import uuid

from fastapi import FastAPI

from .schemas import (
    AgentRequestEnvelope,
    AuthRegisterRequest,
    AuthRegisterResponse,
    InstructionalResponseEnvelope,
    LabConfig,
)
from .services import apply_intervention

app = FastAPI(title="HITL Gateway")


@app.post("/auth/register", response_model=AuthRegisterResponse)
async def auth_register(body: AuthRegisterRequest) -> AuthRegisterResponse:
    """Accept a student token and return mock session configuration."""
    return AuthRegisterResponse(
        arm_id=1,
        project_id="lab-001",
        session_id=str(uuid.uuid4()),
        lab_config=LabConfig(landmarks=["start", "planning", "implementation", "review"]),
    )


@app.post("/interact", response_model=InstructionalResponseEnvelope)
async def interact(envelope: AgentRequestEnvelope) -> InstructionalResponseEnvelope:
    """Accept an AgentRequestEnvelope and return an InstructionalResponseEnvelope."""
    return apply_intervention(envelope)
