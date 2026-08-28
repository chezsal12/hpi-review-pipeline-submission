"""
Automated tests for QualityGateLambda.

The semantic-retention scoring (Bedrock call) is mocked so the tests run
offline with no AWS credentials. Rule-based checks are exercised directly.
"""
import os
import sys

import pytest

from conftest import load_handler_module

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)


@pytest.fixture
def handler_module():
    return load_handler_module("quality_gate_handler", _HERE)


def _sample_event(summary_localized):
    return {
        "review_id": "fr_001",
        "text": "Franchement top ce casque !",
        "source_language": "fr",
        "summary_english": "Positive review praising clear sound and battery life.",
        "summary_localized": summary_localized,
    }


def test_passing_summary_marks_quality_passed(handler_module, monkeypatch):
    monkeypatch.setattr(handler_module, "evaluate_semantic_retention", lambda event: 9)

    # 1 sentence, 16 words -> within 15-50 words and 1-2 sentences
    good_summary = (
        "Avis positif soulignant un son clair des basses solides une autonomie "
        "longue et une excellente qualite globale vraiment."
    )
    result = handler_module.handler(_sample_event(good_summary), None)

    assert result["quality_passed"] is True
    assert result["quality_checks"]["semantic_retention"] is True
    assert result["quality_checks"]["length_valid"] is True
    assert result["quality_score"] == 9
    assert 15 <= result["word_count"] <= 50


def test_low_semantic_score_fails_gate(handler_module, monkeypatch):
    monkeypatch.setattr(handler_module, "evaluate_semantic_retention", lambda event: 3)

    good_length = (
        "Avis positif soulignant un son clair des basses solides une autonomie "
        "longue et une excellente qualite globale vraiment."
    )
    result = handler_module.handler(_sample_event(good_length), None)

    assert result["quality_checks"]["semantic_retention"] is False
    assert result["quality_passed"] is False


def test_too_short_summary_fails_length_check(handler_module, monkeypatch):
    monkeypatch.setattr(handler_module, "evaluate_semantic_retention", lambda event: 10)

    result = handler_module.handler(_sample_event("Trop court."), None)

    assert result["quality_checks"]["length_valid"] is False
    assert result["quality_passed"] is False


def test_missing_summary_localized_raises_key_error(handler_module, monkeypatch):
    monkeypatch.setattr(handler_module, "evaluate_semantic_retention", lambda event: 8)
    event = _sample_event("whatever")
    del event["summary_localized"]

    with pytest.raises(KeyError):
        handler_module.handler(event, None)


def test_semantic_scoring_parses_and_clamps():
    """Exercise the service-layer scoring parser via a fake Bedrock client."""
    import quality_gate_service as svc

    class FakeBody:
        def read(self):
            import json
            return json.dumps({"content": [{"type": "text", "text": "The score is 42"}]})

    class FakeBedrock:
        def invoke_model(self, **kwargs):
            return {"body": FakeBody()}

    svc.bedrock = FakeBedrock()
    event = _sample_event("Avis positif clair.")
    # "42" should be clamped to the documented 1-10 maximum.
    assert svc.evaluate_semantic_retention(event) == 10


def test_semantic_scoring_falls_back_on_error():
    """A Bedrock failure returns the default middle score, not an exception."""
    import quality_gate_service as svc

    class BoomBedrock:
        def invoke_model(self, **kwargs):
            raise RuntimeError("bedrock unavailable")

    svc.bedrock = BoomBedrock()
    event = _sample_event("Avis positif clair.")
    assert svc.evaluate_semantic_retention(event) == svc.DEFAULT_SCORE
