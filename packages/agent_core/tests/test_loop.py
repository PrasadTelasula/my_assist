from conftest import end_turn, tool_use

from agent_core.events import (
    IterationStart,
    ModelResponse,
    RunComplete,
    ToolCallEnd,
    ToolCallStart,
)
from agent_core.loop import run_agent
from agent_core.providers.base import CompletionResult, TokenUsage
from agent_core.providers.fake import FakeProvider
from agent_core.tools.registry import ToolRegistry


def calculator(expression: str) -> str:
    """Evaluate a basic arithmetic expression.

    Args:
        expression: The arithmetic expression to evaluate, e.g. "2+2".
    """
    return str(eval(expression, {"__builtins__": {}}, {}))  # noqa: S307 - test-only


async def collect(gen):
    return [event async for event in gen]


async def test_loop_yields_end_turn_events() -> None:
    provider = FakeProvider([end_turn("Hello!")])
    events = await collect(
        run_agent(
            provider=provider,
            system_prompt="You are helpful.",
            messages=[{"role": "user", "content": "Hi"}],
            registry=ToolRegistry(),
        )
    )
    assert isinstance(events[0], IterationStart)
    assert events[0].iteration == 0
    assert isinstance(events[1], ModelResponse)
    assert events[1].text == "Hello!"
    assert isinstance(events[-1], RunComplete)
    assert events[-1].final_text == "Hello!"
    assert events[-1].error is None


async def test_loop_executes_tool_and_feeds_result_back() -> None:
    provider = FakeProvider(
        [
            tool_use("calculator", {"expression": "2+2"}, id="tu_42"),
            end_turn("The answer is 4"),
        ]
    )
    registry = ToolRegistry()
    registry.register(calculator)

    events = await collect(
        run_agent(
            provider=provider,
            system_prompt="sys",
            messages=[{"role": "user", "content": "what is 2+2?"}],
            registry=registry,
        )
    )

    starts = [e for e in events if isinstance(e, ToolCallStart)]
    ends = [e for e in events if isinstance(e, ToolCallEnd)]
    assert len(starts) == 1
    assert starts[0].name == "calculator"
    assert starts[0].input == {"expression": "2+2"}
    assert len(ends) == 1
    assert ends[0].output == "4"
    assert ends[0].is_error is False
    assert isinstance(events[-1], RunComplete)
    assert events[-1].final_text == "The answer is 4"

    # The second provider call must have received the tool result message.
    second_call_messages = provider.calls[1]["messages"]
    assert second_call_messages[-1]["role"] == "user"
    result_block = second_call_messages[-1]["content"][0]
    assert result_block["type"] == "tool_result"
    assert result_block["tool_use_id"] == "tu_42"
    assert result_block["content"] == "4"
    # And the assistant's tool_use turn was appended before it.
    assert second_call_messages[-2]["role"] == "assistant"


async def test_loop_tool_error_is_reported_not_raised() -> None:
    def broken(x: str) -> str:
        """Always fails.

        Args:
            x: Ignored.
        """
        raise ValueError("boom")

    provider = FakeProvider([tool_use("broken", {"x": "1"}), end_turn("recovered")])
    registry = ToolRegistry()
    registry.register(broken)

    events = await collect(
        run_agent(provider=provider, system_prompt="s", messages=[], registry=registry)
    )
    ends = [e for e in events if isinstance(e, ToolCallEnd)]
    assert ends[0].is_error is True
    assert "boom" in ends[0].output
    assert isinstance(events[-1], RunComplete)


async def test_loop_unknown_tool_returns_error_result() -> None:
    provider = FakeProvider([tool_use("nope", {}), end_turn("ok")])
    events = await collect(
        run_agent(provider=provider, system_prompt="s", messages=[], registry=ToolRegistry())
    )
    ends = [e for e in events if isinstance(e, ToolCallEnd)]
    assert ends[0].is_error is True
    assert "unknown tool" in ends[0].output.lower()


async def test_loop_stops_at_max_iterations() -> None:
    provider = FakeProvider([tool_use("calculator", {"expression": "1+1"}, id=f"tu_{i}") for i in range(5)])
    registry = ToolRegistry()
    registry.register(calculator)

    events = await collect(
        run_agent(
            provider=provider,
            system_prompt="s",
            messages=[],
            registry=registry,
            max_iterations=3,
        )
    )
    iterations = [e for e in events if isinstance(e, IterationStart)]
    assert len(iterations) == 3
    assert isinstance(events[-1], RunComplete)
    assert events[-1].error == "max_iterations_reached"


async def test_loop_refusal_stops_with_error() -> None:
    refusal = CompletionResult(
        text="",
        raw_content=[],
        tool_calls=[],
        stop_reason="refusal",
        usage=TokenUsage(input_tokens=1, output_tokens=1),
        cost_usd=0.0,
        latency_ms=1,
    )
    provider = FakeProvider([refusal])
    events = await collect(
        run_agent(provider=provider, system_prompt="s", messages=[], registry=ToolRegistry())
    )
    assert isinstance(events[-1], RunComplete)
    assert events[-1].error == "refusal"


async def test_model_response_carries_usage_and_cost() -> None:
    provider = FakeProvider([end_turn("hi", usage=TokenUsage(input_tokens=7, output_tokens=13))])
    events = await collect(
        run_agent(provider=provider, system_prompt="s", messages=[], registry=ToolRegistry())
    )
    resp = next(e for e in events if isinstance(e, ModelResponse))
    assert resp.usage.input_tokens == 7
    assert resp.usage.output_tokens == 13
    assert resp.cost_usd == 0.001
    assert resp.latency_ms == 5
