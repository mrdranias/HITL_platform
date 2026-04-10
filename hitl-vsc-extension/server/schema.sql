-- HITL Gateway — PostgreSQL schema
-- Auto-executed on first connection by PostgresStore._get_pool().
-- Can also be run manually:  psql $DATABASE_URL -f schema.sql

CREATE TABLE IF NOT EXISTS sessions (
    session_id     TEXT PRIMARY KEY,
    student_id     TEXT NOT NULL,
    project_id     TEXT NOT NULL,
    arm_id         INTEGER NOT NULL,
    client_version TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS interactions (
    interaction_id         BIGSERIAL PRIMARY KEY,
    session_id             TEXT NOT NULL REFERENCES sessions(session_id),
    interaction_index      INTEGER NOT NULL,
    request_json           JSONB NOT NULL,
    response_json          JSONB NOT NULL,
    workflow_landmark      TEXT,
    planning_document      TEXT,
    drift_injected         BOOLEAN NOT NULL,
    intervention_id        TEXT,
    original_response_hash TEXT,
    request_timestamp      TIMESTAMPTZ NOT NULL,
    server_timestamp       TIMESTAMPTZ NOT NULL,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS error_events (
    error_event_id BIGSERIAL PRIMARY KEY,
    session_id     TEXT NOT NULL,
    message        TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_assignments (
    student_token  TEXT PRIMARY KEY,
    arm_id         INTEGER NOT NULL CHECK (arm_id IN (1, 2, 3)),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
