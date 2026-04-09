from datetime import datetime, timezone
from hashlib import sha256

from .llm_adapter import call_llm
from .schemas import AgentRequestEnvelope, InstructionalResponseEnvelope


def _hash_response(text: str) -> str:
    return sha256(text.encode()).hexdigest()


async def apply_intervention(
    envelope: AgentRequestEnvelope,
) -> InstructionalResponseEnvelope:
    """Intervention service (DESIGN.md §6.2 step 5).

    All arms: call the upstream LLM and buffer the full response.
    Arm 1 & 2: return the upstream response unmodified.
    Arm 3: placeholder for drift injection — currently returns unmodified.
    """
    # Call upstream LLM (buffered — required for drift transforms)
    llm_response = await call_llm(envelope.messages)

    drift_injected = False
    intervention_id: str | None = None
    response_content = llm_response

    if envelope.arm_id == 3 and envelope.workflow_landmark is not None:
        # TODO: implement concept-aligned drift transformation
        # When implemented, mutate response_content here and set:
        #   drift_injected = True
        #   intervention_id = "<rule-id>"
        pass

    return InstructionalResponseEnvelope(
        response_content=response_content,
        drift_injected=drift_injected,
        intervention_id=intervention_id,
        original_response_hash=_hash_response(llm_response),
        server_timestamp=datetime.now(timezone.utc),
    )
