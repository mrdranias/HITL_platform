# HITL AI Lab Routing Extension — Design Document

## 1. Project Overview

The HITL AI Lab Routing Extension is a client-side mediation adapter designed for pedagogical intervention in AI-assisted coding. It acts as a bridge between the student's IDE and an authoritative instructional server, allowing for the logging of interactions and the programmatic injection of *objective drift* to teach diagnostic skills.

This extension is the primary instrumentation tool for a three-arm pilot study evaluating whether explicit human-in-the-loop (HITL) control training improves student performance in AI-assisted coding and concept learning. The extension must support all three arms of the study: unstructured AI use (Arm 1), structured HITL control (Arm 2), and HITL control with injected drift (Arm 3).

---

## 2. Core Architecture

The system follows a **Centralized Gateway Model**:

```
┌──────────────────────────────────┐
│         VS Code (Student)        │
│  ┌────────────────────────────┐  │
│  │  HITL Routing Extension    │  │
│  │ (LanguageModelChatProvider)│  │
│  └────────────┬───────────────┘  │
└───────────────┼──────────────────┘
                │ POST AgentRequestEnvelope
                ▼
┌───────────────────────────────────┐
│    FastAPI Server (Gateway)       │
│  ┌─────────────┐  ┌────────────┐  │
│  │ Auth/Policy │  │Intervention│  │
│  │   Engine    │  │  Engine    │  │
│  └─────────────┘  └─────┬──────┘  │
└─────────────────────────┼─────────┘
                          │
                          ▼
              Upstream LLM (buffered)
                          │
                          ▼
        InstructionalResponseEnvelope
                (returned to client)
```

**Components:**

- **Client:** A VS Code Extension (TypeScript) that registers as a `LanguageModelChatProvider` and mediates all student LLM interactions.
- **Server:** A FastAPI (Python) backend that enforces per-arm policy, applies transformations, and persists authoritative interaction logs.
- **Data Format:** All client-server communication is encapsulated in `AgentRequestEnvelope` and `InstructionalResponseEnvelope` schemas (defined in [Section 5](#5-envelope-schemas)).

### 2.1 Repository Structure

This project is maintained as a **mono-repo**. The client and server are tightly coupled via shared schema contracts, and the small research-team scale makes co-location practical.

```
hitl-vsc-extension/
├── extension/          # VS Code extension (TypeScript)
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
├── server/             # FastAPI backend (Python)
│   ├── app/
│   ├── requirements.txt
│   └── pyproject.toml
├── docs/               # Additional documentation and lab configs
├── DESIGN.md           # This document
└── README.md
```

---

## 3. Functional Requirements

### 3.1 Provider Registration

The extension must register as a `vscode.lm.LanguageModelChatProvider` to natively receive interaction payloads from the VS Code language model API. Because this API requires users to explicitly select the registered model, all study participants (all arms) must use this provider. This ensures logging comparability across arms — no arm uses native, unmediated LLM access.

### 3.2 Authentication and Arm Assignment

On first activation, the extension prompts the student for an opaque **student token** issued by the instructor. The extension sends this token to the server, which returns:

- `arm_id` (1, 2, or 3)
- `project_id`
- `session_id`
- Lab configuration (including workflow landmark definitions)

The token is persisted in VS Code `SecretStorage` and reused for subsequent sessions. The extension never stores arm assignment logic locally; all assignment is controlled server-side.

### 3.3 Per-Arm Extension Behavior

The extension behaves differently per arm, as determined by the server-returned `arm_id`:

| Arm | Mode | Description |
|-----|------|-------------|
| 1 | **Passthrough** | Logs all interactions. Server returns the upstream LLM response unmodified. |
| 2 | **Mediation** | Logs all interactions. Server may attach planning-context enforcement but does not inject drift. |
| 3 | **Mediation + Drift** | Logs all interactions. Server applies concept-aligned drift transformations at specified workflow landmarks. |

### 3.4 Session Binding

Every request envelope must include `student_id`, `project_id`, `session_id`, `arm_id`, `workflow_landmark`, and `client_version`. See [Section 5](#5-envelope-schemas) for the full field specification.

### 3.5 Mediation Layer

The extension captures the outbound message history from the VS Code LM API, wraps it in an `AgentRequestEnvelope`, and transmits it via `POST` to the server API. For Arms 2 and 3, the active planning document content is also included in the envelope.

### 3.6 Planning Artifact Integration (Arms 2 and 3)

The extension provides a VS Code command (`hitl.setPlanningDocument`) that allows students to designate a file in their workspace as the active planning document for the session. When set:

- The document's content is attached to each `AgentRequestEnvelope` as the `planning_document` field.
- For Arms 2 and 3, the extension enforces that a planning document must be set before the first LLM call in a session. If no document is set, the extension blocks the request and prompts the student to set one.

This supports the study's requirement to separate planning from execution phases.

### 3.7 Drift Landmark Signaling (Arm 3)

The extension tracks the current `workflow_landmark` for each session. Landmarks are defined in the lab configuration returned by the server at session initialization. The client includes the current landmark in every request envelope. The **server — not the client — decides** whether to inject drift based on arm assignment and landmark state. This preserves experimental consistency across study arms.

### 3.8 Response Rendering

Upon receiving an `InstructionalResponseEnvelope` from the server, the extension streams the `response_content` to the VS Code chat interface in chunks, providing a smooth streaming UX comparable to native Copilot. The server always returns a complete (buffered) response; the extension handles the chunk-streaming locally for display purposes.

---

## 4. Technical Stack

| Concern | Technology | Notes |
|---------|------------|-------|
| Language (client) | TypeScript | VS Code Extension API |
| Language (server) | Python 3.11+ | FastAPI |
| Networking | Native `fetch` (Node 18+) | No Axios dependency |
| Schema validation | Zod (client) / Pydantic (server) | Enforce envelope integrity |
| Credential storage | VS Code `SecretStorage` | Student token persistence |
| Database | PostgreSQL | Authoritative interaction log, server-side |
| Local logging | VS Code `ExtensionContext.globalStorageUri` | Session recovery only (see [Section 7.2](#72-session-recovery)) |

**Note on `fetch` vs. Axios:** VS Code ships with Node.js 18+, which includes a native `fetch` implementation. Axios is not needed and should not be added as a dependency.

---

## 5. Envelope Schemas

These schemas are the canonical contract between the extension and the server. Both sides must validate against them. The TypeScript implementation uses Zod; the Python implementation uses Pydantic.

### 5.1 `AgentRequestEnvelope`

Sent from the extension to the server on every LLM request.

| Field | Type | Description |
|-------|------|-------------|
| `student_id` | `string` | Opaque, de-identified student identifier |
| `session_id` | `string` (UUID) | Identifies the current lab session |
| `project_id` | `string` | Identifies the lab assignment |
| `arm_id` | `1 \| 2 \| 3` | Study arm; assigned by server at auth, echoed by client |
| `messages` | `Array<{ role: string; content: string }>` | Full conversation history |
| `timestamp` | `string` (ISO 8601) | Client-side timestamp of the request |
| `workflow_landmark` | `string \| null` | Current position in the lab workflow |
| `planning_document` | `string \| null` | Content of active planning doc (Arms 2/3); null for Arm 1 |
| `client_version` | `string` | Extension version string (semver) |

### 5.2 `InstructionalResponseEnvelope`

Returned from the server to the extension.

| Field | Type | Description |
|-------|------|-------------|
| `response_content` | `string` | The (potentially transformed) LLM response |
| `drift_injected` | `boolean` | Whether drift was applied in this response |
| `intervention_id` | `string \| null` | Identifier of the applied intervention rule, if any |
| `original_response_hash` | `string \| null` | SHA-256 of the un-transformed response, for audit |
| `server_timestamp` | `string` (ISO 8601) | Server-side timestamp of the response |

---

## 6. Interaction Workflow

### 6.1 First-Use Authentication Flow

```
1. Student activates extension for the first time.
2. Extension prompts for student token.
3. Extension POSTs token to /auth/register.
4. Server returns: arm_id, project_id, session_id, lab config (landmarks).
5. Extension stores token in SecretStorage; stores session state in memory.
```

### 6.2 Standard Request Loop (per interaction)

```
1. Capture      — Student submits a prompt; extension receives full message
                  history via provideLanguageModelChatResponse().

2. Landmark     — Extension determines current workflow_landmark from
                  lab config and interaction count.

3. Wrap         — Extension constructs AgentRequestEnvelope, including
                  planning_document if set (Arms 2/3).

4. Transmit     — Extension POSTs envelope to /interact on the server.

5. Transform    — Server's Intervention Engine:
                    Arm 1: Passes request to upstream LLM, returns unmodified.
                    Arm 2: Passes request to upstream LLM, returns unmodified
                           (but logs for analysis).
                    Arm 3: Passes request to upstream LLM, buffers full
                           response, applies concept-aligned drift at the
                           configured landmark, returns modified response.

6. Render       — Extension receives InstructionalResponseEnvelope, streams
                  response_content to VS Code chat UI in chunks.
```

### 6.3 Streaming and Latency

The server **buffers the full upstream LLM response** before applying any drift transformation, because transformations (e.g., introducing an off-by-one indexing error into a complete code block) require the full output to be available. This introduces higher round-trip latency compared to native streaming Copilot. This tradeoff is acceptable in a controlled lab environment. The extension mitigates perceived latency by streaming the received response content to the VS Code UI progressively after receipt.

### 6.4 Planning Artifact Flow (Arms 2 and 3)

```
1. Student opens a planning document (objective spec or world model).
2. Student runs the "HITL: Set Planning Document" command.
3. Extension stores the document path in session state.
4. On each LLM request, extension reads the current content of the
   planning document and includes it in planning_document field.
5. If no planning document is set and arm_id is 2 or 3, extension
   blocks the LLM request and displays a prompt to set one.
```

---

## 7. Error Handling and Degradation

### 7.1 Server Unreachable

If the server cannot be reached:

- The extension displays a clear error message to the student.
- The extension retries with **exponential backoff** (initial delay 1s, max 3 retries).
- After retries are exhausted, the request fails with a user-visible error.
- **The extension must never silently fall back to an unmediated LLM call.** Doing so would compromise study arm integrity.
- The failure is recorded in the local session log (see [Section 7.2](#72-session-recovery)).

### 7.2 Session Recovery

The local session log (stored in `ExtensionContext.globalStorageUri`) records only:

- `session_id`
- `project_id`
- `arm_id`
- Index of the last successfully completed interaction
- Timestamps and error events

This is sufficient for the server to reconstruct session continuity if the client disconnects mid-lab. Full interaction content is **not** stored locally; the server is the authoritative log.

### 7.3 Timeout Policy

HTTP requests to the server have a configurable timeout, defaulting to **30 seconds**. On timeout, the same retry and failure behavior as Section 7.1 applies.

---

## 8. Constraints and Non-Responsibilities

- The extension does not implement its own reasoning, planning, or memory.
- All intervention and pedagogical logic must remain on the server to ensure experimental consistency across study arms.
- The extension does not determine arm assignment. Arm is server-assigned at authentication and treated as read-only by the client.
- The extension does not store full interaction logs locally. Local logs contain only session recovery metadata.
- The extension does not access or collect repository history. Repository histories required for the study (per the paper's data collection plan) are collected via git hooks or server-side polling — not via the extension.
- The extension does not send any personally identifying information. The `student_id` is an opaque token assigned by the instructor.

---

## 9. Data Collection Notes

This section documents the extension's scope of responsibility relative to the study's data collection plan.

| Data Type | Collected By | Notes |
|-----------|-------------|-------|
| Interaction logs (prompts, responses) | Server | Authoritative; de-identified by opaque student token |
| `drift_injected` flags | Server | Recorded per-response in `InstructionalResponseEnvelope` |
| Planning artifacts | Extension → Server | Attached to `AgentRequestEnvelope`; stored server-side |
| Repository histories / early versions | Git hooks or server polling | **Not** the extension's responsibility |
| Traditional assessment results | Separate system | Not captured by this extension |

**De-identification:** The extension never transmits a student's real name, email, or institution. The student token issued by the instructor is the sole identifier. All downstream de-identification and aggregation is the server's responsibility.

**IRB Compliance:** Interaction logging is limited to what is described in the study's data collection plan. Students are informed of logging through the standard IRB consent process. The extension should surface a one-time disclosure notice on first activation, before the authentication token is entered.
