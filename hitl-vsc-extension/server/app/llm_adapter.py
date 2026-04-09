"""Upstream LLM adapter.

Calls the OpenAI-compatible Chat Completions API (works with OpenAI,
Azure OpenAI, or any provider that exposes the same interface).

All configuration is read from environment variables:
  LLM_API_KEY        — API key (required)
  LLM_BASE_URL       — Base URL override (optional, defaults to OpenAI)
  LLM_MODEL          — Model identifier (optional, defaults to gpt-4o)
  LLM_MAX_TOKENS     — Max response tokens (optional, defaults to 2048)
  LLM_TEMPERATURE    — Sampling temperature (optional, defaults to 0.7)

The adapter always returns the full buffered response as a single string,
matching the design requirement that drift transformations operate on
the complete output (DESIGN.md §6.3).
"""

from __future__ import annotations

import os
from typing import Any

import httpx

from .schemas import Message

_API_KEY: str | None = None
_BASE_URL: str = "https://api.openai.com/v1"
_MODEL: str = "gpt-4o"
_MAX_TOKENS: int = 2048
_TEMPERATURE: float = 0.7
_CLIENT: httpx.AsyncClient | None = None


def _get_config() -> tuple[str, str, str, int, float]:
    global _API_KEY, _BASE_URL, _MODEL, _MAX_TOKENS, _TEMPERATURE
    _API_KEY = os.environ.get("LLM_API_KEY", _API_KEY)
    _BASE_URL = os.environ.get("LLM_BASE_URL", _BASE_URL)
    _MODEL = os.environ.get("LLM_MODEL", _MODEL)
    _MAX_TOKENS = int(os.environ.get("LLM_MAX_TOKENS", str(_MAX_TOKENS)))
    _TEMPERATURE = float(os.environ.get("LLM_TEMPERATURE", str(_TEMPERATURE)))
    if not _API_KEY:
        raise RuntimeError(
            "LLM_API_KEY environment variable is not set. "
            "The server cannot call the upstream LLM without it."
        )
    return _API_KEY, _BASE_URL, _MODEL, _MAX_TOKENS, _TEMPERATURE


def _get_client() -> httpx.AsyncClient:
    global _CLIENT
    if _CLIENT is None:
        _CLIENT = httpx.AsyncClient(timeout=120.0)
    return _CLIENT


async def call_llm(messages: list[Message]) -> str:
    """Send messages to the upstream LLM and return the full buffered response."""
    api_key, base_url, model, max_tokens, temperature = _get_config()
    client = _get_client()

    payload: dict[str, Any] = {
        "model": model,
        "messages": [{"role": m.role, "content": m.content} for m in messages],
        "max_completion_tokens": max_tokens,
        "temperature": temperature,
    }

    response = await client.post(
        f"{base_url}/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
    )
    if not response.is_success:
        body = response.text
        raise RuntimeError(
            f"Upstream LLM returned {response.status_code}: {body}"
        )

    data = response.json()
    return data["choices"][0]["message"]["content"]
