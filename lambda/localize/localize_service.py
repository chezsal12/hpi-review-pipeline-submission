# Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

"""
Service layer for the localize stage.

Holds the localization business logic so the Lambda entry point
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


def localize_summary(summary, target_language, source_language='en'):
    """
    Translate an English summary into the review's source language.

    Returns the localized string. Botocore exceptions propagate to the
    caller so the handler can log and surface a typed failure.
    """
    return translate_text(summary, source_language, target_language)
