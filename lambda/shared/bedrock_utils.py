# Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

"""
Shared helpers for parsing Amazon Bedrock (Claude messages API) responses.

Used by the summarize and quality-gate service layers so the response
text-block extraction logic lives in exactly one place.
"""


def extract_text_block(result_body):
    """
    Return the first text block's stripped text from a Bedrock messages
    response body, or None if no text block is present.
    """
    for block in result_body.get('content', []):
        if block.get('type') == 'text':
            return block['text'].strip()
    return None
