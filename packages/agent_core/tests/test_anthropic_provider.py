from types import SimpleNamespace
from typing import Any

import pytest

from agent_core.providers.anthropic_provider import AnthropicProvider, compute_cost_usd


class FakeMessages:
    """Stands in for anthropic.AsyncAnthropic().messages."""

    def __init__(self, response: Any) -> None:
        self._response = response
        self.create_kwargs: dict[str, Any] | None = None

    async def create(self, **kwargs: Any) -> Any:
        self.create_kwargs = kwargs
        return self._response


def make_message(content: list[Any], stop_reason: str = "end_turn") -> Any:
    return SimpleNamespace(
        content=content,
        stop_reason=stop_reason,
        usage=SimpleNamespace(
            input_tokens=100,
            output_tokens=50,
            cache_creation_input_tokens=0,
            cache_read_input_tokens=0,
        ),
    )


def text_block(text: str) -> Any:
    return SimpleNamespace(type="text", text=text)


def tool_block(id: str, name: str, input: dict) -> Any:
    return SimpleNamespace(type="tool_use", id=id, name=name, input=input)


@pytest.fixture
def provider() -> AnthropicProvider:
    return AnthropicProvider(api_key="test-key", model="claude-sonnet-5")


async def test_parses_end_turn(provider: AnthropicProvider) -> None:
    fake = FakeMessages(make_message([text_block("Hello there")]))
    provider._client = SimpleNamespace(messages=fake)  # type: ignore[assignment]

    result = await provider.complete(system="s", messages=[{"role": "user", "content": "hi"}], tools=[])
    assert result.text == "Hello there"
    assert result.stop_reason == "end_turn"
    assert result.tool_calls == []
    assert result.usage.input_tokens == 100
    assert result.usage.output_tokens == 50
    assert result.cost_usd > 0
    # temperature / budget_tokens must never be sent (rejected by current models)
    assert fake.create_kwargs is not None
    assert "temperature" not in fake.create_kwargs
    assert "budget_tokens" not in fake.create_kwargs


async def test_parses_tool_use(provider: AnthropicProvider) -> None:
    fake = FakeMessages(
        make_message(
            [text_block("Let me check."), tool_block("tu_9", "search", {"q": "news"})],
            stop_reason="tool_use",
        )
    )
    provider._client = SimpleNamespace(messages=fake)  # type: ignore[assignment]

    result = await provider.complete(system="s", messages=[], tools=[{"name": "search"}])
    assert result.stop_reason == "tool_use"
    assert len(result.tool_calls) == 1
    assert result.tool_calls[0].id == "tu_9"
    assert result.tool_calls[0].name == "search"
    assert result.tool_calls[0].input == {"q": "news"}
    # raw_content is serializable provider-native blocks, echoed back in the loop
    assert result.raw_content[1]["type"] == "tool_use"
    assert fake.create_kwargs["tools"] == [{"name": "search"}]


def test_cost_table_known_model() -> None:
    cost = compute_cost_usd("claude-sonnet-5", input_tokens=1_000_000, output_tokens=0)
    assert cost == pytest.approx(3.0)
    cost = compute_cost_usd("claude-sonnet-5", input_tokens=0, output_tokens=1_000_000)
    assert cost == pytest.approx(15.0)


def test_cost_table_unknown_model_falls_back() -> None:
    # Unknown models should not crash cost accounting; fall back to sonnet pricing.
    cost = compute_cost_usd("some-future-model", input_tokens=1000, output_tokens=1000)
    assert cost > 0
