# Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

"""
Service layer for review summarization.

This module holds the business logic for generating product-review
summaries (prompt construction, model invocation, response parsing) so
that the Lambda entry point (handler.py) stays a thin adapter.
"""
import json
import os
import sys

import boto3

# Make the shared helpers importable both locally and when packaged
# alongside this function.
_SHARED = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'shared')
if _SHARED not in sys.path:
    sys.path.insert(0, _SHARED)

from bedrock_utils import extract_text_block  # noqa: E402

bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')

MODEL_ID = 'us.anthropic.claude-sonnet-5'

# Summary business rules (kept in the service layer, not the entry point).
MIN_WORDS = 15
MAX_WORDS = 50
MIN_SENTENCES = 1
MAX_SENTENCES = 2
MAX_TOKENS = 150


def build_prompt(translated_text):
    """Construct the summarization prompt for a translated review."""
    return f"""You are a product review summarizer for e-commerce PDPs.

Review: {translated_text}

  
Generate a concise 1-2 sentence summary that captures:
1. Overall sentiment (positive/negative/mixed)
2. Key product aspects mentioned (e.g., battery, sound quality, build)
3. Main reason for the rating
  
CRITICAL Requirements:
- MUST be exactly {MIN_SENTENCES}-{MAX_SENTENCES} sentences
- MUST be between {MIN_WORDS}-{MAX_WORDS} words total
- If approaching {MAX_WORDS} words, prioritize brevity over detail
- Factual and specific
- No promotional language
- Clear sentiment indicator
- Output ONLY the summary text, nothing else
  
Summary:"""


def parse_summary(result_body):
    """Extract the first text block from a Bedrock messages response.

    Thin wrapper over the shared bedrock_utils.extract_text_block helper.
    """
    return extract_text_block(result_body)


def generate_summary(translated_text):
    """
    Generate a 1-2 sentence English summary of a translated review.

    Raises botocore exceptions from the Bedrock call to the caller so the
    Lambda handler can log and surface a typed failure.
    """
    prompt = build_prompt(translated_text)

    response = bedrock.invoke_model(
        modelId=MODEL_ID,
        body=json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": MAX_TOKENS,
            "messages": [{
                "role": "user",
                "content": prompt
            }],
        })
    )

    result_body = json.loads(response['body'].read())
    return parse_summary(result_body)
