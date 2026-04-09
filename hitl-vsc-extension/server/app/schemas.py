from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class Message(BaseModel):
    role: str
    content: str


class AgentRequestEnvelope(BaseModel):
    student_id: str
    session_id: str = Field(json_schema_extra={"format": "uuid"})
    project_id: str
    arm_id: Literal[1, 2, 3]
    messages: list[Message]
    timestamp: datetime
    workflow_landmark: str | None
    planning_document: str | None
    client_version: str


class InstructionalResponseEnvelope(BaseModel):
    response_content: str
    drift_injected: bool
    intervention_id: str | None
    original_response_hash: str | None
    server_timestamp: datetime


class AuthRegisterRequest(BaseModel):
    student_token: str


class LabConfig(BaseModel):
    landmarks: list[str]


class AuthRegisterResponse(BaseModel):
    arm_id: Literal[1, 2, 3]
    project_id: str
    session_id: str
    lab_config: LabConfig
