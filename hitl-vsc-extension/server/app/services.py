from datetime import datetime, timezone
from hashlib import sha256

from .llm_adapter import call_llm
from .schemas import AgentRequestEnvelope, InstructionalResponseEnvelope, Message

_PLANNING_SYSTEM_PROMPT = (
    "The student has provided the following planning document for this "
    "session. Use it as planning context for your response, and remain "
    "consistent with it unless the user explicitly changes the plan.\n\n"
    "Planning document:\n{planning_document}"
)


def _hash_response(text: str) -> str:
    return sha256(text.encode()).hexdigest()


def _build_llm_messages(envelope: AgentRequestEnvelope) -> list[Message]:
    """Build the message list sent to the upstream LLM.

    For Arms 2 and 3 the planning document (if present) is prepended as a
    system message.  Arm 1 always sends the chat history unmodified.

    NOTE: This augmented list is used *only* for the LLM call.  The
    persistence layer stores the original envelope.messages as received
    from the client.
    """
    messages: list[Message] = []
    if (
        envelope.arm_id in (2, 3)
        and envelope.planning_document
    ):
        messages.append(
            Message(
                role="system",
                content=_PLANNING_SYSTEM_PROMPT.format(
                    planning_document=envelope.planning_document,
                ),
            )
        )
    messages.extend(envelope.messages)
    return messages


async def apply_intervention(
    envelope: AgentRequestEnvelope,
) -> InstructionalResponseEnvelope:
    """Intervention service (DESIGN.md §6.2 step 5).

    All arms: call the upstream LLM and buffer the full response.
    Arm 1 & 2: return the upstream response unmodified.
    Arm 3: apply drift injection at the "implementation" landmark.
    """
    # Build LLM prompt — Arms 2/3 get a planning-context system message
    llm_messages = _build_llm_messages(envelope)

    # Call upstream LLM (buffered — required for drift transforms)
    llm_response = await call_llm(llm_messages)

    drift_injected = False
    intervention_id: str | None = None
    response_content = llm_response

    if envelope.arm_id == 3 and envelope.workflow_landmark == "implementation":
        response_content += (
            "\n\n---\n"
            "💡 **Instructor hint:** Before running this code, "
            "review your planning document and verify that the approach "
            "aligns with your stated objectives."
        )
        drift_injected = True
        intervention_id = "impl_hint_v1"

    return InstructionalResponseEnvelope(
        response_content=response_content,
        drift_injected=drift_injected,
        intervention_id=intervention_id,
        original_response_hash=_hash_response(llm_response),
        server_timestamp=datetime.now(timezone.utc),
    )
