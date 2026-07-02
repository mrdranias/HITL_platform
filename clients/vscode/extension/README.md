# HITL AI Lab Routing

A VS Code extension that routes AI coding assistant interactions through a research server for human-in-the-loop pedagogy studies.

## Overview

This extension replaces the default AI chat model with a mediated routing layer. All student–AI interactions pass through a research server that can apply instructional interventions (e.g., objective-drift injection, planning scaffolds) based on the student's assigned experimental arm.

## Features

- **Transparent routing** — works with VS Code's native chat interface and a built-in sidebar chat panel
- **Experimental arms** — supports multiple study conditions with per-arm behavior (planning document requirements, landmark-based scaffolding)
- **Privacy-first** — all outbound payloads are sanitized to remove local file paths, OS usernames, and machine hostnames before transmission
- **Secure authentication** — student tokens are stored in VS Code's SecretStorage; sessions use client-generated UUIDs
- **Configurable server** — the routing server URL is set via VS Code settings (`hitlRouting.serverUrl`)

## Getting Started

1. Install the extension from the direct Marketplace link provided by your instructor.
2. On first launch, accept the research data-collection disclosure.
3. Enter the student token provided to you.
4. Open the **HITL AI Lab** sidebar panel and acknowledge the session disclaimer to begin.

## Commands

| Command | Description |
|---|---|
| `HITL: Set Planning Document` | Designate the active editor as your planning document (required for Arms 2 & 3) |
| `HITL: Reset Token` | Clear your stored token and re-authenticate |
| `HITL: Test Chat` | Send a test message through the routing model |

## Settings

| Setting | Default | Description |
|---|---|---|
| `hitlRouting.serverUrl` | `http://localhost:8000` | URL of the HITL routing server |

## Data Collection Notice

This extension logs AI interaction prompts and responses to a research server for study purposes. No personally identifying information is collected — only an opaque student token. By using this extension, you acknowledge this data collection as described in the study consent form.
