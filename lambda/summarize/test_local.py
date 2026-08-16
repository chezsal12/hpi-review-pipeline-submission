"""
Automated tests for SummarizeLambda.

The handler delegates to summarize_service.generate_summary, which is
mocked here so the tests run offline with no AWS credentials. One test
also exercises the service-layer response parser directly.
"""
import importlib.util
import os
import sys

import pytest
from botocore.exceptions import ClientError

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)


def _load_handler_module():
    """Load this directory's handler.py under a unique module name."""
    if _HERE not in sys.path:
        sys.path.insert(0, _HERE)
    spec = importlib.util.spec_from_file_location(
        "summarize_handler", os.path.join(_HERE, "handler.py")
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def handler_module():
    return _load_handler_module()


def _sample_event():
    return {
        "review_id": "fr_001",
        "text": "Franchement top ce casque !",
        "source_language": "fr",
        "language": "fr",
        "product_category": "headphones",
        "true_sentiment": "positive",
        "translated_text": "Great headphones! Clear sound, good bass, long battery life.",
    }


def test_happy_path_summary_within_word_limits(handler_module, monkeypatch):
    fake_summary = (
        "Positive review praising the headphones for clear sound quality, "
        "strong bass response, and impressively long battery life overall."
    )
    monkeypatch.setattr(handler_module, "generate_summary", lambda text: fake_summary)

    event = _sample_event()
    result = handler_module.handler(event, None)

    assert "summary_english" in result
    summary = result["summary_english"]
    assert isinstance(summary, str)
    assert summary.strip() != ""

    # Business rule: 15-50 words
    word_count = len(summary.split())
    assert 15 <= word_count <= 50

    # Pass-through: original fields preserved
    for key, value in event.items():
        assert result[key] == value


def test_missing_translated_text_raises_key_error(handler_module, monkeypatch):
    monkeypatch.setattr(handler_module, "generate_summary", lambda text: "summary")
    event = _sample_event()
    del event["translated_text"]

    with pytest.raises(KeyError):
        handler_module.handler(event, None)


def test_bedrock_client_error_propagates(handler_module, monkeypatch):
    def _raise(text):
        raise ClientError(
            {"Error": {"Code": "ThrottlingException", "Message": "slow down"}},
            "InvokeModel",
        )

    monkeypatch.setattr(handler_module, "generate_summary", _raise)

    with pytest.raises(ClientError):
        handler_module.handler(_sample_event(), None)


def test_empty_translated_text_returns_defined_state(handler_module, monkeypatch):
    # Service returns None when the model yields no usable text block.
    monkeypatch.setattr(handler_module, "generate_summary", lambda text: None)

    event = _sample_event()
    event["translated_text"] = ""
    result = handler_module.handler(event, None)

    assert "summary_english" in result
    assert result["summary_english"] is None


def test_service_parse_summary_handles_malformed_response():
    """Directly exercise the service-layer parser for robustness."""
    import summarize_service

    # No text block -> None
    assert summarize_service.parse_summary({"content": []}) is None
    assert summarize_service.parse_summary({}) is None

    # Text block -> stripped text
    body = {"content": [{"type": "text", "text": "  hello  "}]}
    assert summarize_service.parse_summary(body) == "hello"
