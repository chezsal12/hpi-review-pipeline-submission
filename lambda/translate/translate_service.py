"""
Service layer for the translate stage.

Holds the translation business logic so the Lambda entry point
(handler.py) stays a thin adapter. The Amazon Translate client and
translate_text call are delegated to the shared translate_utils helper so
that logic lives in exactly one place.
"""
import os
import sys

# Make the shared helpers importable both locally and when packaged
# alongside this function.
_SHARED = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'shared')
if _SHARED not in sys.path:
    sys.path.insert(0, _SHARED)

from translate_utils import translate_text  # noqa: E402


def translate_review(text, source_language, target_language='en'):
    """
    Translate review text into the target language (English by default).

    Returns the translated string. Botocore exceptions propagate to the
    caller so the handler can log and surface a typed failure.
    """
    return translate_text(text, source_language, target_language)
