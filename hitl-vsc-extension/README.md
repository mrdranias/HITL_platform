# HITL AI Lab Routing Extension

A VS Code extension and FastAPI server for a three-arm pilot study evaluating human-in-the-loop (HITL) control training in AI-assisted coding. See [`DESIGN.md`](DESIGN.md) for the full design document.

## Repository Layout

```
hitl-vsc-extension/
├── extension/        # VS Code extension (TypeScript)
├── server/           # FastAPI gateway (Python)
├── docs/             # Demo artifacts and documentation
├── DESIGN.md         # Authoritative design document
└── README.md         # This file
```

## Quick Start

### 1. Server

```bash
cd server
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # then fill in LLM_API_KEY
uvicorn app.main:app --reload
```

The server runs on `http://localhost:8000`. Set `DATABASE_URL` in `.env` to use PostgreSQL; otherwise data is written to `server/data/hitl_log.jsonl`.

### 2. Extension

```bash
cd extension
npm install
npm run compile
```

Then press **F5** in VS Code to launch the Extension Development Host.

### 3. Demo (Arm 3 end-to-end)

1. Start the server (defaults to Arm 3 for the demo tokens).
2. Launch the extension in the development host.
3. Accept the IRB disclosure.
4. Enter a student token (e.g. `charlie` for Arm 3 — see `server/student_assignments.json`).
5. Open `docs/demo.md` in the editor and run **"HITL: Set Planning Document"**.
6. Chat — the 3rd interaction triggers the instructor hint.

See [`DESIGN.md` §6.7](DESIGN.md) for the full demo flow.

## Student Tokens

Tokens are mapped to study arms via `server/student_assignments.json` (or the `student_assignments` DB table when PostgreSQL is configured):

| Token | Arm | Description |
|-------|-----|-------------|
| `alpha` | 1 | Passthrough |
| `bravo` | 2 | Planning-context mediation |
| `charlie` | 3 | Mediation + drift |
| `delta` | 1 | Passthrough |
| `echo` | 2 | Planning-context mediation |
| `foxtrot` | 3 | Mediation + drift |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LLM_API_KEY` | Yes | — | OpenAI-compatible API key |
| `LLM_BASE_URL` | No | `https://api.openai.com/v1` | Base URL override |
| `LLM_MODEL` | No | `gpt-4o` | Model identifier |
| `LLM_MAX_TOKENS` | No | `2048` | Max response tokens |
| `LLM_TEMPERATURE` | No | `0.7` | Sampling temperature |
| `DATABASE_URL` | No | — | PostgreSQL connection string |

## License

ISC
