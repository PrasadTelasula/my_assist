import pytest

from agent_core.tools.registry import ToolRegistry


def lookup_weather(city: str, units: str = "celsius") -> str:
    """Look up the current weather for a city.

    Args:
        city: Name of the city to look up.
        units: Temperature units, either "celsius" or "fahrenheit".
    """
    return f"20 {units} in {city}"


async def add_numbers(a: int, b: int) -> str:
    """Add two integers.

    Args:
        a: First number.
        b: Second number.
    """
    return str(a + b)


def test_registry_generates_anthropic_schema_from_signature() -> None:
    registry = ToolRegistry()
    registry.register(lookup_weather)

    schemas = registry.anthropic_schemas()
    assert len(schemas) == 1
    schema = schemas[0]
    assert schema["name"] == "lookup_weather"
    assert schema["description"].startswith("Look up the current weather")
    props = schema["input_schema"]["properties"]
    assert props["city"] == {"type": "string", "description": "Name of the city to look up."}
    assert props["units"]["type"] == "string"
    assert schema["input_schema"]["required"] == ["city"]


async def test_registry_executes_sync_and_async_tools() -> None:
    registry = ToolRegistry()
    registry.register(lookup_weather)
    registry.register(add_numbers)

    result = await registry.execute("lookup_weather", {"city": "Pune"})
    assert result.output == "20 celsius in Pune"
    assert result.is_error is False
    assert result.duration_ms >= 0

    result = await registry.execute("add_numbers", {"a": 2, "b": 3})
    assert result.output == "5"


async def test_registry_unknown_tool() -> None:
    registry = ToolRegistry()
    result = await registry.execute("missing", {})
    assert result.is_error is True
    assert "unknown tool" in result.output.lower()


def test_registry_rejects_duplicate_names() -> None:
    registry = ToolRegistry()
    registry.register(lookup_weather)
    with pytest.raises(ValueError):
        registry.register(lookup_weather)


def test_registry_int_bool_and_number_types() -> None:
    def f(count: int, ratio: float, enabled: bool) -> str:
        """Test typed params.

        Args:
            count: A count.
            ratio: A ratio.
            enabled: A flag.
        """
        return "ok"

    registry = ToolRegistry()
    registry.register(f)
    props = registry.anthropic_schemas()[0]["input_schema"]["properties"]
    assert props["count"]["type"] == "integer"
    assert props["ratio"]["type"] == "number"
    assert props["enabled"]["type"] == "boolean"


def test_registry_unregister_and_replace() -> None:
    registry = ToolRegistry()
    registry.register(lookup_weather)
    registry.unregister("lookup_weather")
    assert registry.anthropic_schemas() == []
    registry.register(lookup_weather)  # re-register after removal is fine
    assert len(registry.anthropic_schemas()) == 1
