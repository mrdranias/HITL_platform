from hashlib import sha256

from .schemas import AgentRequestEnvelope, InstructionalResponseEnvelope


def _hash_response(text: str) -> str:
    return sha256(text.encode()).hexdigest()


def apply_intervention(
    envelope: AgentRequestEnvelope,
) -> InstructionalResponseEnvelope:
    """Stub intervention service.

    Arm 1 & 2: return a mock upstream LLM response unmodified.
    Arm 3: placeholder for drift injection — currently returns unmodified.
    """
    from datetime import datetime, timezone

    mock_llm_response = "This is a mock LLM response."

    drift_injected = False
    intervention_id: str | None = None

    if envelope.arm_id == 3 and envelope.workflow_landmark is not None:
        # TODO: implement concept-aligned drift transformation
        drift_injected = False
        intervention_id = None

    return InstructionalResponseEnvelope(
        response_content=mock_llm_response,
        drift_injected=drift_injected,
        intervention_id=intervention_id,
        original_response_hash=_hash_response(mock_llm_response),
        server_timestamp=datetime.now(timezone.utc),
    )
