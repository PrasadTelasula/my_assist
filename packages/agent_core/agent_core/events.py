"""Typed events yielded by the agent loop.

Every event is a frozen dataclass with a stable ``type`` string and a
``payload()`` dict, so transports (DB rows, SSE, JSONL traces) can serialize
uniformly without knowing each event class.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

from agent_core.providers.base import TokenUsage


@dataclass(frozen=True)
class AgentEvent:
    type: str = field(init=False, default="agent_event")

    def payload(self) -> dict[str, Any]:
        data = asdict(self)
        data.pop("type", None)
        return data


@dataclass(frozen=True)
class IterationStart(AgentEvent):
    iteration: int
    type: str = field(init=False, default="iteration_start")


@dataclass(frozen=True)
class ModelResponse(AgentEvent):
    iteration: int
    text: str
    usage: TokenUsage
    cost_usd: float
    latency_ms: int
    type: str = field(init=False, default="model_response")


@dataclass(frozen=True)
class ToolCallStart(AgentEvent):
    iteration: int
    tool_use_id: str
    name: str
    input: dict[str, Any]
    type: str = field(init=False, default="tool_call_start")


@dataclass(frozen=True)
class ToolCallEnd(AgentEvent):
    iteration: int
    tool_use_id: str
    output: str
    is_error: bool
    duration_ms: int
    type: str = field(init=False, default="tool_call_end")


@dataclass(frozen=True)
class RunComplete(AgentEvent):
    final_text: str | None
    error: str | None = None
    type: str = field(init=False, default="run_complete")
