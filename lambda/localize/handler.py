# Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

"""
LocalizeLambda entry point.

Thin adapter: parses the event, delegates to the service layer, and
returns the enriched event (pass-through pattern).
"""
from localize_service import localize_summary


def handler(event, context):
    """
    Localize the English summary back into the review's source language.

    Input requires 'summary_english' and 'source_language'.
    Returns: the full event with a 'summary_localized' field added.
    """
    try:
        summary = event['summary_english']
        target_lang = event['source_language']

        result = event.copy()
        result['summary_localized'] = localize_summary(summary, target_lang)
        return result

    except Exception as e:
        print(f"Localization error: {str(e)}")
        raise
