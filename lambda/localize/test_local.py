# Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

"""
Automated tests for LocalizeLambda.

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
        "localize_handler", os.path.join(_HERE, "handler.py")
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
        "summary_english": "Positive review highlighting clear sound, good bass, and long battery life.",
    }


def test_happy_path_localizes_and_preserves_fields(handler_module, monkeypatch):
    def fake_localize(summary, target_language, source_language='en'):
        assert source_language == "en"
        assert target_language == "fr"
        return "Avis positif : son clair, bonnes basses, longue autonomie."

    monkeypatch.setattr(handler_module, "localize_summary", fake_localize)

    event = _sample_event()
    result = handler_module.handler(event, None)

    # Localized summary added and non-empty
    assert "summary_localized" in result
    assert isinstance(result["summary_localized"], str)
    assert result["summary_localized"].strip() != ""

    # Original English summary preserved (pass-through)
    assert result["summary_english"] == event["summary_english"]
    for key, value in event.items():
        assert result[key] == value


def test_missing_summary_english_raises_key_error(handler_module, monkeypatch):
    monkeypatch.setattr(
        handler_module, "localize_summary",
        lambda summary, target_language, source_language='en': "x",
    )
    event = _sample_event()
    del event["summary_english"]

    with pytest.raises(KeyError):
        handler_module.handler(event, None)


def test_translate_client_error_propagates(handler_module, monkeypatch):
    def _raise(summary, target_language, source_language='en'):
        raise ClientError(
            {"Error": {"Code": "UnsupportedLanguagePairException", "Message": "bad pair"}},
            "TranslateText",
        )

    monkeypatch.setattr(handler_module, "localize_summary", _raise)

    with pytest.raises(ClientError):
        handler_module.handler(_sample_event(), None)


def test_unsupported_target_language_propagates(handler_module, monkeypatch):
    def _raise(summary, target_language, source_language='en'):
        raise ClientError(
            {"Error": {"Code": "InvalidRequestException", "Message": "unsupported language"}},
            "TranslateText",
        )

    monkeypatch.setattr(handler_module, "localize_summary", _raise)

    event = _sample_event()
    event["source_language"] = "xx"  # unsupported language code

    with pytest.raises(ClientError):
        handler_module.handler(event, None)
