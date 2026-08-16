"""
Automated tests for TranslateLambda.

Covers the happy path plus error/edge cases. All Amazon Translate calls
are mocked, so these tests run offline with no AWS credentials.
"""
import importlib.util
import os
import sys

import pytest
from botocore.exceptions import ClientError

_HERE = os.path.dirname(os.path.abspath(__file__))


def _load_handler_module():
    """Load this directory's handler.py under a unique module name."""
    if _HERE not in sys.path:
        sys.path.insert(0, _HERE)
    spec = importlib.util.spec_from_file_location(
        "translate_handler", os.path.join(_HERE, "handler.py")
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
    }


def test_happy_path_adds_translation_and_preserves_fields(handler_module, monkeypatch):
    def fake_translate(text, source_language, target_language='en'):
        assert source_language == "fr"
        assert target_language == "en"
        return "Honestly great headphones!"

    monkeypatch.setattr(handler_module, "translate_review", fake_translate)

    event = _sample_event()
    result = handler_module.handler(event, None)

    # Translation added and non-empty
    assert "translated_text" in result
    assert isinstance(result["translated_text"], str)
    assert result["translated_text"].strip() != ""

    # Pass-through: all original fields preserved
    for key, value in event.items():
        assert result[key] == value


def test_missing_source_language_raises_key_error(handler_module, monkeypatch):
    monkeypatch.setattr(
        handler_module, "translate_review",
        lambda text, source_language, target_language='en': "x",
    )
    event = _sample_event()
    del event["source_language"]

    with pytest.raises(KeyError):
        handler_module.handler(event, None)


def test_translate_client_error_propagates(handler_module, monkeypatch):
    def _raise(text, source_language, target_language='en'):
        raise ClientError(
            {"Error": {"Code": "ThrottlingException", "Message": "slow down"}},
            "TranslateText",
        )

    monkeypatch.setattr(handler_module, "translate_review", _raise)

    with pytest.raises(ClientError):
        handler_module.handler(_sample_event(), None)


def test_empty_text_still_returns_result(handler_module, monkeypatch):
    # Amazon Translate returns an empty translation for empty input.
    monkeypatch.setattr(
        handler_module, "translate_review",
        lambda text, source_language, target_language='en': "",
    )

    event = _sample_event()
    event["text"] = ""
    result = handler_module.handler(event, None)

    assert "translated_text" in result
    assert result["translated_text"] == ""
