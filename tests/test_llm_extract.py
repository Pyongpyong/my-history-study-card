import pytest

from app.llm.client import _safe_json_loads


def test_safe_json_loads_recovers_truncated_object():
    raw = '{"cards": [{"type": "MCQ"}], "meta": {"a": 1}} trailing noise'
    parsed = _safe_json_loads(raw)
    assert parsed == {"cards": [{"type": "MCQ"}], "meta": {"a": 1}}


def test_safe_json_loads_handles_malformed_json():
    raw = '{"cards": ["missing braces"'  # intentionally malformed
    parsed = _safe_json_loads(raw)
    assert parsed == {}


def test_safe_json_loads_handles_non_dict():
    raw = '[]'
    parsed = _safe_json_loads(raw)
    assert parsed == {}
