from agent_core.providers.base import CompletionResult, TokenUsage, ToolCall
from agent_core.providers.fake import FakeProvider

__all__ = ["FakeProvider", "tool_use", "end_turn"]


def tool_use(
    name: str,
    input: dict,
    id: str = "tu_1",
    text: str = "",
    usage: TokenUsage | None = None,
) -> CompletionResult:
    """Build a CompletionResult in which the model requests one tool call."""
    usage = usage or TokenUsage(input_tokens=10, output_tokens=20)
    return CompletionResult(
        text=text,
        raw_content=[
            *([{"type": "text", "text": text}] if text else []),
            {"type": "tool_use", "id": id, "name": name, "input": input},
        ],
        tool_calls=[ToolCall(id=id, name=name, input=input)],
        stop_reason="tool_use",
        usage=usage,
        cost_usd=0.001,
        latency_ms=5,
    )


def end_turn(text: str, usage: TokenUsage | None = None) -> CompletionResult:
    """Build a CompletionResult in which the model finishes with text."""
    usage = usage or TokenUsage(input_tokens=10, output_tokens=20)
    return CompletionResult(
        text=text,
        raw_content=[{"type": "text", "text": text}],
        tool_calls=[],
        stop_reason="end_turn",
        usage=usage,
        cost_usd=0.001,
        latency_ms=5,
    )
